import { expect, test, chromium, type BrowserContext } from "@playwright/test";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";

function firstExistingExecutable(paths: Array<string | undefined>): string | undefined {
  return paths.find((path): path is string => Boolean(path && existsSync(path)));
}

function which(binary: string): string | undefined {
  try {
    const result = execFileSync("which", [binary], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

function resolveChromiumExecutable(): string | undefined {
  const explicit = firstExistingExecutable([
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    process.env.CHROME_PATH,
  ]);
  if (explicit) return explicit;

  if (process.platform !== "linux") return undefined;
  return firstExistingExecutable([
    which("chromium"),
    which("chromium-browser"),
    which("google-chrome-stable"),
    which("google-chrome"),
    which("brave-browser"),
    which("vivaldi"),
  ]);
}

type FixtureServer = { origin: string; close: () => Promise<void> };

async function startFixtureServer(): Promise<FixtureServer> {
  const fixtureRoot = resolve(process.cwd(), "tests/fixtures");
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/fixtures/")) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const relative = decodeURIComponent(url.pathname.replace(/^\/fixtures\//, ""));
      const filePath = resolve(fixtureRoot, normalize(relative));
      if (!filePath.startsWith(`${fixtureRoot}/`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Fixture not found");
        return;
      }

      response.writeHead(200, { "content-type": contentTypeFor(filePath) });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : "Fixture server error");
    }
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not expose a TCP port.");

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())),
  };
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function launchExtensionContext(): Promise<{ context: BrowserContext; extensionId: string; userDataDir: string }> {
  const extensionPath = join(process.cwd(), ".output/chrome-mv3");
  if (!existsSync(extensionPath)) throw new Error(`Built extension not found at ${extensionPath}. Run pnpm run build first.`);

  const userDataDir = await mkdtemp(join(tmpdir(), "css-sentry-e2e-"));
  const executablePath = resolveChromiumExecutable();
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  const existingWorker = context.serviceWorkers()[0];
  const worker = existingWorker ?? await context.waitForEvent("serviceworker", { timeout: 10_000 });
  const match = worker.url().match(/^chrome-extension:\/\/([^/]+)\//);
  if (!match?.[1]) throw new Error(`Could not determine extension id from ${worker.url()}`);

  return { context, extensionId: match[1], userDataDir };
}

async function closeExtensionContext(context: BrowserContext, userDataDir: string): Promise<void> {
  await context.close();
  await rm(userDataDir, { recursive: true, force: true });
}

async function setExtensionPolicy(context: BrowserContext, extensionId: string, policy: Record<string, unknown>): Promise<void> {
  const optionsPage = await context.newPage();
  try {
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
    const expectedFilters = destinationPolicyRegexFilters(policy);

    await optionsPage.evaluate(async ([storedPolicy]) => {
      type ChromeCallbackApi = {
        runtime: {
          lastError?: { message?: string };
          sendMessage: (message: Record<string, unknown>, callback?: (response?: unknown) => void) => void;
        };
        storage: {
          local: {
            set: (items: Record<string, unknown>, callback?: () => void) => void;
          };
        };
      };

      const extensionApi = (globalThis as unknown as { chrome: ChromeCallbackApi }).chrome;
      const lastErrorMessage = () => extensionApi.runtime.lastError?.message;
      const setStorage = (items: Record<string, unknown>) => new Promise<void>((resolveSet, rejectSet) => {
        extensionApi.storage.local.set(items, () => {
          const message = lastErrorMessage();
          if (message) rejectSet(new Error(message));
          else resolveSet();
        });
      });
      const sendRuntimeMessage = (message: Record<string, unknown>) => new Promise<void>((resolveSend, rejectSend) => {
        extensionApi.runtime.sendMessage(message, () => {
          const errorMessage = lastErrorMessage();
          // css-sentry:policy-updated is a notification-style message. Chromium may report that
          // the message port closed when no response payload is sent, even when the service worker
          // received the message and refreshed DNR state. Treat that specific condition as non-fatal
          // and rely on the following DNR rule polling as the actual synchronization gate.
          if (errorMessage && !/message port closed before a response was received/i.test(errorMessage)) rejectSend(new Error(errorMessage));
          else resolveSend();
        });
      });

      await setStorage({ "cssSentry:settings": storedPolicy });
      await sendRuntimeMessage({ type: "css-sentry:policy-updated" });
    }, [policy]);

    if (expectedFilters.length === 0) return;

    await expect.poll(async () => {
      const filters = await optionsPage.evaluate(async () => {
        type ChromeCallbackApi = {
          runtime: { lastError?: { message?: string } };
          declarativeNetRequest: {
            getSessionRules: (callback?: (rules: Array<{ condition?: { urlFilter?: string; regexFilter?: string } }>) => void) => void;
          };
        };
        const extensionApi = (globalThis as unknown as { chrome: ChromeCallbackApi }).chrome;
        return await new Promise<string[]>((resolveRules, rejectRules) => {
          extensionApi.declarativeNetRequest.getSessionRules((rules) => {
            const message = extensionApi.runtime.lastError?.message;
            if (message) {
              rejectRules(new Error(message));
              return;
            }
            resolveRules(rules.map((rule) => rule.condition?.regexFilter ?? rule.condition?.urlFilter).filter((filter): filter is string => Boolean(filter)));
          });
        });
      });
      return expectedFilters.every((filter) => filters.includes(filter));
    }, { timeout: 10_000, message: `Timed out waiting for policy DNR rules: ${expectedFilters.join(", ")}` }).toBe(true);
  } finally {
    await optionsPage.close();
  }
}

function destinationPolicyRegexFilters(policy: Record<string, unknown>): string[] {
  const origins = [
    ...arrayOfStrings(policy.blocklistedOrigins),
    ...arrayOfStrings(policy.allowlistedOrigins),
  ];
  const filters: string[] = [];
  for (const origin of origins) {
    try {
      const escaped = new URL(origin).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filters.push(`^${escaped}/`);
    } catch {
      // Invalid test policy origins are ignored by the extension and by this synchronization helper.
    }
  }
  return filters;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}



async function expectNoHighRiskReport(context: BrowserContext, extensionId: string, message: string): Promise<void> {
  const report = await context.newPage();
  try {
    await report.goto(`chrome-extension://${extensionId}/report.html`);
    await expect.poll(async () => {
      await report.reload();
      const body = await report.locator("body").innerText();
      return !/critical|high|blocked_dnr|https:\/\//i.test(body);
    }, { timeout: 10_000, message }).toBe(true);
  } finally {
    await report.close();
  }
}

function defaultPolicy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: "balanced",
    advancedModeEnabled: false,
    trustedOrigins: [],
    blockedOrigins: [],
    strictOrigins: [],
    allowlistedOrigins: [],
    blocklistedOrigins: [],
    perOriginModes: {},
    logRetentionDays: 14,
    compatibility: {
      enableDnrMitigation: true,
      enableStrictThirdPartyBlocking: true,
      showPartialAnalysisFindings: true,
      enableFirefoxEnhancedMode: false,
      reportExternalSvgImageDocuments: false,
      enableSvgImageDnrPolicy: false,
      enableContentNeutralization: true,
    },
    ...overrides,
  };
}

type BlockingServer = { appOrigin: string; attackerOrigin: string; leakHits: () => number; resetLeakHits: () => void; close: () => Promise<void> };

async function startBlockingServer(): Promise<BlockingServer> {
  let leakHits = 0;
  const server = createServer((request, response) => {
    const host = request.headers.host ?? "";
    const url = new URL(request.url ?? "/", `http://${host || "localhost"}`);
    if (url.pathname === "/strict-blocklist.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(`<!doctype html><html><head><style>body{background-image:url("http://127.0.0.1:${addressPort(server)}/leak.png?via=css")}</style></head><body>strict blocklist fixture</body></html>`);
      return;
    }
    if (url.pathname === "/same-origin-poc.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(`<!doctype html><html><head><style>input[value*=secret]~#probe{background-image:url("http://localhost:${addressPort(server)}/leak.png?via=same-origin-poc")}</style></head><body><input value="secret"><div id="probe">same-origin poc</div></body></html>`);
      return;
    }
    if (url.pathname === "/leak.png") {
      leakHits += 1;
      response.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
      response.end(Buffer.from("iVBORw0KGgo=", "base64"));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  });

  await new Promise<void>((resolveListen) => server.listen(0, resolveListen));
  const port = addressPort(server);
  return {
    appOrigin: `http://localhost:${port}`,
    attackerOrigin: `http://127.0.0.1:${port}`,
    leakHits: () => leakHits,
    resetLeakHits: () => { leakHits = 0; },
    close: () => new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())),
  };
}

function addressPort(server: ReturnType<typeof createServer>): number {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not expose a TCP port.");
  return address.port;
}

test("built extension exposes popup, options, and report pages", async () => {
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByRole("heading", { name: "CSS Sentry" })).toBeVisible();
    await expect(popup.locator("body")).not.toContainText("null");
    await expect(popup.locator("body")).not.toContainText("undefined");

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(options.getByRole("heading", { name: "Options" })).toBeVisible();
    await expect(options.getByRole("button", { name: /Balanced:/ })).toHaveAttribute("aria-pressed", "true");

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);
    await expect(report.getByRole("heading", { name: "Finding report" })).toBeVisible();
  } finally {
    await closeExtensionContext(context, userDataDir);
  }
});

test("content script stores attack findings and report page renders them", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const attackPage = await context.newPage();
    await attackPage.goto(`${server.origin}/fixtures/attacks/rendered-email-style-exfil.html`);
    await expect(attackPage.locator("style")).toHaveCount(2);
    await expect(attackPage.locator("style#css-sentry-neutralization-rules")).toHaveCount(0);
    await expect(attackPage.locator('style[data-css-sentry="content-neutralization"]')).toHaveCount(0);

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);

    await expect.poll(async () => {
      await report.reload();
      return await report.getByText("https://attacker.example").count();
    }, { timeout: 10_000, message: "expected extension report page to render the attack destination origin" }).toBeGreaterThan(0);

    await expect(report.getByText(/critical|high/i)).toBeVisible();
    await expect(report.getByText(/selector\.attribute|sink\.remote_url|url\.cross_origin/)).toBeVisible();
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("same-origin iframe findings are merged into the local report", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/attacks/same-origin-iframe-rendered-email.html`);
    await expect(page.locator("iframe")).toHaveCount(1);

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);

    await expect.poll(async () => {
      await report.reload();
      return await report.getByText(/Frame \d+:/).count();
    }, { timeout: 10_000, message: "expected report page to include frame entries from the top page and iframe" }).toBeGreaterThan(1);

    await expect(report.getByText("https://attacker.example").first()).toBeVisible();
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});


test("top-frame and same-origin iframe findings remain separate in the report", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/attacks/top-and-same-origin-iframe-exfil.html`);
    await expect(page.locator("iframe")).toHaveCount(1);

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);

    await expect.poll(async () => {
      await report.reload();
      const hasTopFinding = await report.getByText("https://top-frame-attacker.example").count() > 0;
      const hasIframeFinding = await report.getByText("https://attacker.example").count() > 0;
      const hasMultipleFrames = await report.getByText(/Frame \d+:/).count() > 1;
      return hasTopFinding && hasIframeFinding && hasMultipleFrames;
    }, { timeout: 10_000, message: "expected top-frame and iframe findings to remain separate in the report" }).toBe(true);

    await expect(report.getByText("Frame URL").first()).toBeVisible();
    await expect(report.getByText("Parent frame").first()).toBeVisible();
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("cross-origin iframe partial coverage respects the partial-analysis display option", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/attacks/cross-origin-iframe-uninspectable.html`);
    await expect(page.locator("iframe")).toHaveCount(1);

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);

    await expect.poll(async () => {
      await report.reload();
      const body = await report.locator("body").innerText();
      return body.includes("Partial frame coverage")
        && body.includes("https://third-party.example.test/mail")
        && body.includes("partial-analysis finding is hidden by the current Options setting");
    }, { timeout: 10_000, message: "expected report page to show partial frame coverage while hiding optional partial-analysis rows by default" }).toBe(true);
    await expect(report.getByText("frame.cross_origin.uninspectable")).toHaveCount(0);

    await setExtensionPolicy(context, extensionId, defaultPolicy());

    await expect.poll(async () => {
      await report.reload();
      return await report.getByText("frame.cross_origin.uninspectable").count();
    }, { timeout: 10_000, message: "expected report page to show cross-origin frame partial coverage when partial-analysis findings are enabled" }).toBeGreaterThan(0);
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});



test("benign carousel fixture remains usable and does not produce high-risk findings", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/benign/amazon-like-carousel.html`);
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);
    await expect.poll(async () => {
      await report.reload();
      const body = await report.locator("body").innerText();
      return !/critical|high|blocked_dnr/i.test(body);
    }, { timeout: 10_000, message: "expected benign carousel fixture to avoid high-risk findings or DNR blocking" }).toBe(true);
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("benign markdown code block remains inert in browser e2e", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/benign/benign-markdown-rendered-code-block.html`);
    await expect(page.locator("pre code")).toContainText("input[value^=\"a\"]");

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);
    await expect.poll(async () => {
      await report.reload();
      const body = await report.locator("body").innerText();
      return !body.includes("https://example.test") && !/critical|high|blocked_dnr/i.test(body);
    }, { timeout: 10_000, message: "expected inert code block CSS to stay out of extension findings" }).toBe(true);
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});


test("benign embedded map widget remains visible and non-blocking", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/benign/embedded-map-widget.html`);
    await expect(page.getByRole("heading", { name: "Embedded map widget" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Local map preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expectNoHighRiskReport(context, extensionId, "expected benign embedded map fixture to avoid high-risk findings or blocking");
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("large static page remains rendered and non-actionable", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/benign/large-static-page.html`);
    await expect(page.getByRole("heading", { name: "Large benign static page" })).toBeVisible();
    await expect(page.locator(".card")).toHaveCount(120);
    await expectNoHighRiskReport(context, extensionId, "expected large benign static page to avoid high-risk findings or blocking");
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("benign webmail theme remains rendered and non-actionable", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/benign/benign-webmail-theme.html`);
    await expect(page.getByLabel("Inbox")).toBeVisible();
    await expect(page.getByText("Welcome message")).toBeVisible();
    await expectNoHighRiskReport(context, extensionId, "expected benign webmail theme to avoid high-risk findings or blocking");
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("Tailwind-like output remains interactive and non-actionable", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/benign/tailwind-like-output.html`);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expectNoHighRiskReport(context, extensionId, "expected Tailwind-like benign output to avoid high-risk findings or blocking");
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("CSS Modules output remains rendered and non-actionable", async () => {
  const server = await startFixtureServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    const page = await context.newPage();
    await page.goto(`${server.origin}/fixtures/benign/css-modules-output.html`);
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByText("Avatar")).toBeVisible();
    await expectNoHighRiskReport(context, extensionId, "expected CSS Modules benign output to avoid high-risk findings or blocking");
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});



test("Balanced finding-derived DNR rules protect matching requests after analysis without claiming first-load prevention", async () => {
  const server = await startBlockingServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    await setExtensionPolicy(context, extensionId, defaultPolicy({ mode: "balanced" }));

    const page = await context.newPage();
    await page.goto(`${server.appOrigin}/same-origin-poc.html`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    const firstLoadLeakHits = server.leakHits();

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/report.html`);
    await expect.poll(async () => {
      await report.reload();
      const body = await report.locator("body").innerText();
      return /precise DNR rule installed after analysis|request blocked by an already-active network rule/i.test(body);
    }, { timeout: 10_000, message: "expected Balanced mode to record same-origin POC network mitigation" }).toBe(true);

    if (firstLoadLeakHits > 0) {
      await expect(report.getByText(/precise DNR rule installed after analysis/i).first()).toBeVisible();
    }
    await report.close();

    server.resetLeakHits();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    expect(server.leakHits()).toBe(0);
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});

test("destination blocklist prevents first-load CSS-triggered requests", async () => {
  const server = await startBlockingServer();
  const { context, extensionId, userDataDir } = await launchExtensionContext();
  try {
    await setExtensionPolicy(context, extensionId, defaultPolicy({
      mode: "strict",
      strictOrigins: [server.appOrigin],
      blocklistedOrigins: [server.attackerOrigin],
    }));

    const page = await context.newPage();
    await page.goto(`${server.appOrigin}/strict-blocklist.html`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toBeVisible();
    expect(server.leakHits()).toBe(0);
  } finally {
    await closeExtensionContext(context, userDataDir);
    await server.close();
  }
});
