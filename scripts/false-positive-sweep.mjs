#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const STORAGE_KEYS = { settings: "cssSentry:settings", reportsPrefix: "cssSentry:tabReport:" };
const SAVE_REPORTS = new Set(["none", "actionable", "all"]);
const DEFAULT_POLICY = {
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
    neverFetchRemoteCssFromExtension: true,
    enableDnrMitigation: true,
    enableStrictThirdPartyBlocking: true,
    showPartialAnalysisFindings: false,
    enableFirefoxEnhancedMode: false,
    reportExternalSvgImageDocuments: false,
    enableSvgImageDnrPolicy: false
  }
};

function parseArgs(argv) {
  const args = {
    limit: Infinity,
    sitesFile: "scripts/false-positive-sites.txt",
    outDir: "test-results/false-positive-sweep",
    extensionPath: process.env.CSS_SENTRY_EXTENSION_PATH || ".output/chrome-mv3",
    timeoutMs: 20000,
    settleMs: 4000,
    headless: false,
    failOnBlocked: false,
    failOnHigh: false,
    saveReports: "actionable"
  };

  // Package managers may expose the argument separator as a literal "--".
  // Treat standalone separators as delimiters so both forms work:
  //   pnpm run audit:false-positives -- --limit 250
  //   pnpm run audit:false-positives --limit 250
  const tokens = argv.filter((arg) => arg !== "--");

  const readValue = (tokens, index, option, inlineValue) => {
    if (inlineValue !== undefined) return [inlineValue, index];
    const next = tokens[index + 1];
    if (next === undefined || next.startsWith("--")) throw new Error(`${option} requires a value.`);
    return [next, index + 1];
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const rawArg = tokens[i];
    const equalsIndex = rawArg.indexOf("=");
    const hasInlineValue = rawArg.startsWith("--") && equalsIndex > 2;
    const arg = hasInlineValue ? rawArg.slice(0, equalsIndex) : rawArg;
    const inlineValue = hasInlineValue ? rawArg.slice(equalsIndex + 1) : undefined;

    if (arg === "--limit") {
      const [value, nextIndex] = readValue(tokens, i, arg, inlineValue);
      args.limit = Number(value);
      i = nextIndex;
    } else if (arg === "--sites") {
      const [value, nextIndex] = readValue(tokens, i, arg, inlineValue);
      args.sitesFile = value;
      i = nextIndex;
    } else if (arg === "--out") {
      const [value, nextIndex] = readValue(tokens, i, arg, inlineValue);
      args.outDir = value;
      i = nextIndex;
    } else if (arg === "--extension") {
      const [value, nextIndex] = readValue(tokens, i, arg, inlineValue);
      args.extensionPath = value;
      i = nextIndex;
    } else if (arg === "--timeout-ms") {
      const [value, nextIndex] = readValue(tokens, i, arg, inlineValue);
      args.timeoutMs = Number(value);
      i = nextIndex;
    } else if (arg === "--settle-ms") {
      const [value, nextIndex] = readValue(tokens, i, arg, inlineValue);
      args.settleMs = Number(value);
      i = nextIndex;
    } else if (arg === "--save-reports") {
      const [value, nextIndex] = readValue(tokens, i, arg, inlineValue);
      args.saveReports = value;
      i = nextIndex;
    } else if (arg === "--headless") args.headless = true;
    else if (arg === "--fail-on-blocked") args.failOnBlocked = true;
    else if (arg === "--fail-on-high") args.failOnHigh = true;
    else if (arg === "--help" || arg === "-h") { printHelp(); process.exit(0); }
    else throw new Error(`Unknown argument: ${rawArg}`);
  }
  if (!Number.isFinite(args.limit) && args.limit !== Infinity) throw new Error("--limit must be a number.");
  if (Number.isFinite(args.limit) && args.limit < 1) throw new Error("--limit must be at least 1.");
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) throw new Error("--timeout-ms must be a positive number.");
  if (!Number.isFinite(args.settleMs) || args.settleMs < 0) throw new Error("--settle-ms must be zero or a positive number.");
  if (!SAVE_REPORTS.has(args.saveReports)) throw new Error("--save-reports must be one of: none, actionable, all.");
  return args;
}

function printHelp() {
  console.log(`CSS Sentry false-positive sweep\n\nUsage:\n  pnpm run build\n  pnpm run audit:false-positives -- --limit 250\n\nOptions:\n  --sites <file>        Newline-delimited URL/domain list. Defaults to scripts/false-positive-sites.txt.\n  --limit <n>           Limit number of sites visited. Defaults to every site in the list.\n  --out <dir>           Output directory. Default: test-results/false-positive-sweep\n  --extension <dir>     Built extension path. Default: .output/chrome-mv3\n  --timeout-ms <n>      Navigation timeout per site. Default: 20000\n  --settle-ms <n>       Time to wait after load for extension reports. Default: 4000\n  --save-reports <mode> Save full per-site report payloads: none, actionable, or all. Default: actionable\n  --headless            Try headless Chromium. Extension support may vary by browser version.\n  --fail-on-blocked     Exit non-zero if any site produces blocked_dnr findings.\n  --fail-on-high        Exit non-zero if any site produces high/critical actionable findings.\n`);
}

function which(binary) {
  try { return execFileSync("which", [binary], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined; }
  catch { return undefined; }
}
function chromiumExecutable() {
  return [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, process.env.CHROMIUM_PATH, process.env.CHROME_PATH, which("chromium"), which("chromium-browser"), which("google-chrome-stable"), which("google-chrome"), which("brave-browser")].find((path) => path && existsSync(path));
}
function loadSites(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => /^https?:\/\//i.test(line) ? line : `https://${line}`);
}

async function launchExtension(extensionPath, headless) {
  const absoluteExtensionPath = resolve(extensionPath);
  if (!existsSync(absoluteExtensionPath)) throw new Error(`Built extension not found at ${absoluteExtensionPath}. Run pnpm run build first.`);
  const userDataDir = await mkdtemp(join(tmpdir(), "css-sentry-fp-sweep-"));
  const context = await chromium.launchPersistentContext(userDataDir, { headless, executablePath: chromiumExecutable(), args: [`--disable-extensions-except=${absoluteExtensionPath}`, `--load-extension=${absoluteExtensionPath}`], ignoreHTTPSErrors: true });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15000 });
  const match = worker.url().match(/^chrome-extension:\/\/([^/]+)\//);
  if (!match?.[1]) throw new Error(`Could not determine extension id from ${worker.url()}`);
  return { context, extensionId: match[1], userDataDir };
}

async function extensionStoragePage(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  return page;
}
async function setDefaultPolicy(storagePage) {
  await storagePage.evaluate(async ([key, policy]) => {
    const api = globalThis.chrome;
    await new Promise((resolve, reject) => api.storage.local.set({ [key]: policy }, () => api.runtime.lastError ? reject(new Error(api.runtime.lastError.message)) : resolve()));
    await new Promise((resolve) => api.runtime.sendMessage({ type: "css-sentry:policy-updated" }, () => resolve()));
  }, [STORAGE_KEYS.settings, DEFAULT_POLICY]);
}
async function clearReports(storagePage) {
  await storagePage.evaluate(async ([prefix]) => {
    const api = globalThis.chrome;
    const all = await new Promise((resolve, reject) => api.storage.local.get(null, (items) => api.runtime.lastError ? reject(new Error(api.runtime.lastError.message)) : resolve(items)));
    const keys = Object.keys(all).filter((key) => key.startsWith(prefix));
    if (keys.length > 0) await new Promise((resolve, reject) => api.storage.local.remove(keys, () => api.runtime.lastError ? reject(new Error(api.runtime.lastError.message)) : resolve()));
  }, [STORAGE_KEYS.reportsPrefix]);
}
async function readReports(storagePage) {
  return storagePage.evaluate(async ([prefix]) => {
    const api = globalThis.chrome;
    const all = await new Promise((resolve, reject) => api.storage.local.get(null, (items) => api.runtime.lastError ? reject(new Error(api.runtime.lastError.message)) : resolve(items)));
    return Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith(prefix)));
  }, [STORAGE_KEYS.reportsPrefix]);
}

function summarizeReport(url, reports, error = null) {
  const values = Object.values(reports || {});
  const findings = values.flatMap((report) => report?.summary?.findings || []);
  const actionable = findings.filter((finding) => finding.severity !== "info");
  const changed = findings.filter((finding) => changesPage(finding.action));
  const blocked = findings.filter((finding) => finding.action === "blocked_dnr" || finding.action === "blocked_strict_third_party");
  const coverage = findings.filter(isCoverageFinding);
  const infoOnly = findings.filter((finding) => finding.severity === "info" && !isCoverageFinding(finding));
  const loggedOnly = actionable.filter((finding) => !changesPage(finding.action));
  const high = actionable.filter((finding) => finding.severity === "high" || finding.severity === "critical");
  return {
    url,
    ok: !error,
    error,
    reportCount: values.length,
    findingCount: findings.length,
    actionableCount: actionable.length,
    loggedOnlyCount: loggedOnly.length,
    infoOnlyCount: infoOnly.length,
    coverageCount: coverage.length,
    changedCount: changed.length,
    highOrCriticalCount: high.length,
    blockedCount: blocked.length,
    topReasons: topCounts(countBy(findings.flatMap((finding) => finding.reasons || []))),
    topProperties: topCounts(countBy(findings.map((finding) => finding.property).filter(Boolean))),
    topDestinations: topCounts(countBy(findings.map((finding) => finding.destinationOrigin).filter(Boolean))),
    topSources: topCounts(countBy(findings.map((finding) => finding.sourceOrigin).filter(Boolean))),
    sampleFindings: findings.slice(0, 12).map((finding) => ({ severity: finding.severity, action: finding.action, confidence: finding.confidence, property: finding.property, selector: finding.selector, destinationOrigin: finding.destinationOrigin, sourceOrigin: finding.sourceOrigin, reasons: finding.reasons, details: finding.details }))
  };
}
function changesPage(action) { return action === "blocked_dnr" || action === "blocked_strict_third_party" || action === "neutralized" || action === "disabled_stylesheet" || action === "removed_style_node"; }
function isCoverageFinding(finding) { return (finding.reasons || []).some((reason) => reason.startsWith("stylesheet.") || reason.startsWith("frame.") || reason.startsWith("resource.svg_image_document") || reason.startsWith("analysis.skipped")); }
function shouldSaveReports(mode, summary) { return mode === "all" || (mode === "actionable" && summary.actionableCount > 0); }
function saveReports(outDir, index, url, summary, reports) {
  const reportsDir = join(outDir, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const host = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "_");
  const path = join(reportsDir, `${String(index + 1).padStart(3, "0")}-${host}.json`);
  writeFileSync(path, JSON.stringify({ url, summary, reports }, null, 2));
  return path;
}
function countBy(values) { const counts = new Map(); for (const value of values) counts.set(value, (counts.get(value) || 0) + 1); return counts; }
function topCounts(counts, limit = 10) { return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count })); }
function csvEscape(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allSites = loadSites(args.sitesFile);
  if (Number.isFinite(args.limit) && args.limit > allSites.length) console.warn(`Requested --limit ${args.limit}, but ${args.sitesFile} contains only ${allSites.length} site(s). Scanning all listed sites.`);
  const sites = allSites.slice(0, Number.isFinite(args.limit) ? args.limit : undefined);
  mkdirSync(args.outDir, { recursive: true });
  const runStartedAt = new Date().toISOString();
  const { context, extensionId, userDataDir } = await launchExtension(args.extensionPath, args.headless);
  const storagePage = await extensionStoragePage(context, extensionId);
  await setDefaultPolicy(storagePage);
  const results = [];
  try {
    for (const [index, url] of sites.entries()) {
      await clearReports(storagePage);
      const page = await context.newPage();
      let error = null;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: args.timeoutMs });
        await page.waitForTimeout(args.settleMs);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      } finally {
        await page.close().catch(() => undefined);
      }
      const reports = await readReports(storagePage);
      const summary = summarizeReport(url, reports, error);
      if (shouldSaveReports(args.saveReports, summary)) summary.reportPath = saveReports(args.outDir, index, url, summary, reports);
      results.push(summary);
      console.log(`${index + 1}/${sites.length} ${url} actionable=${summary.actionableCount} loggedOnly=${summary.loggedOnlyCount} coverage=${summary.coverageCount} high=${summary.highOrCriticalCount} blocked=${summary.blockedCount}${summary.reportPath ? ` report=${summary.reportPath}` : ""}${error ? ` error=${error}` : ""}`);
    }
  } finally {
    await storagePage.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
  const run = { runStartedAt, runFinishedAt: new Date().toISOString(), policy: DEFAULT_POLICY, sitesFile: args.sitesFile, saveReports: args.saveReports, sitesScanned: sites.length, results };
  const stamp = runStartedAt.replace(/[:.]/g, "-");
  const jsonPath = join(args.outDir, `false-positive-sweep-${stamp}.json`);
  const csvPath = join(args.outDir, `false-positive-sweep-${stamp}.csv`);
  writeFileSync(jsonPath, JSON.stringify(run, null, 2));
  writeFileSync(csvPath, [["url", "ok", "findingCount", "actionableCount", "loggedOnlyCount", "infoOnlyCount", "coverageCount", "changedCount", "highOrCriticalCount", "blockedCount", "topReasons", "reportPath", "error"].join(","), ...results.map((r) => [r.url, r.ok, r.findingCount, r.actionableCount, r.loggedOnlyCount, r.infoOnlyCount, r.coverageCount, r.changedCount, r.highOrCriticalCount, r.blockedCount, r.topReasons.map((i) => `${i.value}:${i.count}`).join(";"), r.reportPath || "", r.error || ""].map(csvEscape).join(","))].join("\n"));
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
  if (args.failOnBlocked && results.some((r) => r.blockedCount > 0)) process.exitCode = 2;
  if (args.failOnHigh && results.some((r) => r.highOrCriticalCount > 0)) process.exitCode = 3;
}
main().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : error); process.exit(1); });
