import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";



function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function walkFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return [path];
  });
}

function expectNoRepeatedTimestampCorruption(path: string, content: string): void {
  const timestampCount = content.match(/Last Updated:/g)?.length ?? 0;
  const maximumLineLength = Math.max(...content.split("\n").map((line) => line.length));

  expect(timestampCount, `${path} must not repeat Last Updated metadata through the document body`).toBeLessThanOrEqual(3);
  expect(maximumLineLength, `${path} must not contain metadata-injected overlong lines`).toBeLessThan(1_200);
}

describe("project structure", () => {
  it("uses tests/fixtures and not test-fixtures", () => {
    expect(existsSync(join(process.cwd(), "tests", "fixtures"))).toBe(true);
    expect(existsSync(join(process.cwd(), "test-fixtures"))).toBe(false);
  });
  it("has automated unit, integration, e2e, and UI tests", () => {
    for (const dir of ["tests/unit/core", "tests/unit/browser", "tests/unit/ui", "tests/integration", "tests/e2e"]) {
      expect(existsSync(join(process.cwd(), dir)), dir).toBe(true);
      expect(readdirSync(join(process.cwd(), dir)).some((file) => file.endsWith(".test.ts") || file.endsWith(".test.tsx") || file.endsWith(".spec.ts")), dir).toBe(true);
    }
  });

  it("keeps non-README project docs under docs/", () => {
    expect(existsSync(join(process.cwd(), "README.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "SPEC.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "CVE_SPEC.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "STATUS.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "SECURITY.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "PRIVACY.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "PERMISSIONS.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "SELF_SECURITY.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "RELEASE_CHECKLIST.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "RELEASE_NOTES.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "SPEC.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "CVE_SPEC.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "STATUS.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "SECURITY.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "PRIVACY.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "PERMISSIONS.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "RELEASE_CHECKLIST.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "SELF_SECURITY.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "RELEASE_NOTES.md"))).toBe(false);
  });

  it("keeps Last Updated metadata out of README and website-specific documents", () => {
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(readme).not.toMatch(/Last Updated:/);

    for (const websiteDocument of [
      "docs/STATUS_WEBSITE.md",
      "docs/website/TEST_LAB_OVERHAUL_PLAN.md",
      "docs/website/TEST_LAB_COVERAGE_CONTROL.md",
    ]) {
      const content = readProjectFile(websiteDocument);
      expect(content, `${websiteDocument} must not contain website Last Updated metadata`).not.toMatch(/Last Updated:/);
    }
  });

  it("keeps SVG icon lightweight", () => {
    const size = statSync(join(process.cwd(), "src/assets/icon.svg")).size;
    expect(size).toBeLessThan(20_000);
  });

  it("keeps runtime and documentation image assets while preserving SVG", () => {
    expect(existsSync(join(process.cwd(), "src/assets/icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/assets/icon.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "chrome-extension-logo.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "firefox-addon-logo.svg"))).toBe(true);
  });


  it("keeps the false-positive sweep as a development-only tool", () => {
    expect(existsSync(join(process.cwd(), "scripts", "false-positive-sweep.mjs"))).toBe(true);
    expect(existsSync(join(process.cwd(), "scripts", "false-positive-sites.txt"))).toBe(true);
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.["audit:false-positives"]).toBe("node scripts/false-positive-sweep.mjs");
    const script = readFileSync(join(process.cwd(), "scripts", "false-positive-sweep.mjs"), "utf8");
    expect(script).toContain("test-results/false-positive-sweep");
    expect(script).not.toContain("fetch(");
  });

  it("ignores generated test output directories and AI reports", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toContain("test-results");
    expect(gitignore).toContain("json-report.json");
  });

  it("keeps React entrypoints small by moving repeated UI into components", () => {
    expect(existsSync(join(process.cwd(), "src", "shared", "components", "InfoTooltip.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src", "entrypoints", "options", "components.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src", "entrypoints", "popup", "components.tsx"))).toBe(true);

    const maxEntrypointLines: Record<string, number> = {
      "src/entrypoints/options/OptionsApp.tsx": 260,
      "src/entrypoints/popup/App.tsx": 180,
    };
    for (const [file, maxLines] of Object.entries(maxEntrypointLines)) {
      const lineCount = readFileSync(join(process.cwd(), file), "utf8").split("\n").length;
      expect(lineCount, `${file} should stay orchestration-focused`).toBeLessThanOrEqual(maxLines);
    }
  });

  it("keeps UI root mounting behind a checked shared boundary", () => {
    const mountText = readFileSync(join(process.cwd(), "src", "shared", "mountReactRoot.tsx"), "utf8");
    expect(mountText).toContain("export function mountReactRoot");
    expect(mountText).toContain("ReactDOM.createRoot(root).render");
    expect(mountText).toContain("CSS Sentry UI root #${rootId} was not found.");

    for (const file of ["src/entrypoints/options/main.tsx", "src/entrypoints/popup/main.tsx", "src/entrypoints/report/main.tsx"]) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text, `${file} should use the checked root-mount boundary`).toContain('mountReactRoot(\"root\"');
      expect(text, `${file} should not use unchecked root assertions`).not.toContain('getElementById(\"root\")!');
      expect(text, `${file} should not duplicate ReactDOM root wiring`).not.toContain("ReactDOM.createRoot");
    }
  });

  it("keeps package 5 UI lifecycle, options state, and popup derivation in separate authorities", () => {
    const expectedModules = [
      "src/browser/scanner/documentScanController.ts",
      "src/entrypoints/options/useOptionsState.ts",
      "src/entrypoints/options/optionsPolicyActions.ts",
      "src/entrypoints/popup/usePopupState.ts",
      "src/entrypoints/popup/popupDerivedState.ts",
      "src/entrypoints/popup/popupFindingState.ts",
    ];
    for (const file of expectedModules) expect(existsSync(join(process.cwd(), file)), file).toBe(true);

    const contentText = readFileSync(join(process.cwd(), "src", "entrypoints", "content.ts"), "utf8");
    const controllerText = readFileSync(join(process.cwd(), "src", "browser", "scanner", "documentScanController.ts"), "utf8");
    const optionsText = readFileSync(join(process.cwd(), "src", "entrypoints", "options", "OptionsApp.tsx"), "utf8");
    const optionsStateText = readFileSync(join(process.cwd(), "src", "entrypoints", "options", "useOptionsState.ts"), "utf8");
    const popupText = readFileSync(join(process.cwd(), "src", "entrypoints", "popup", "App.tsx"), "utf8");
    const popupStateText = readFileSync(join(process.cwd(), "src", "entrypoints", "popup", "usePopupState.ts"), "utf8");
    const popupDerivedText = readFileSync(join(process.cwd(), "src", "entrypoints", "popup", "popupDerivedState.ts"), "utf8");

    expect(contentText).not.toContain("MutationObserver");
    expect(contentText).not.toContain("createDebouncedScanScheduler");
    expect(controllerText).toContain("createDocumentScanController");
    expect(controllerText).toContain("dispose(): void");
    expect(optionsText).not.toContain("saveSitePolicy");
    expect(optionsText).not.toContain("getSitePolicy");
    expect(optionsText).not.toContain("getDnrStatus");
    expect(optionsText).not.toContain("normalizeOriginInput");
    expect(optionsStateText).toContain("Promise.all([getSitePolicy(), getDnrStatus()])");
    expect(popupText).not.toContain("browser.tabs.query");
    expect(popupText).not.toContain("filterFindingsForDisplay");
    expect(popupText).not.toContain("countHiddenPartialAnalysisFindings");
    expect(popupStateText).toContain("browser.tabs.query");
    expect(popupDerivedText).toContain("export function derivePopupViewState");
    expect(popupDerivedText).toContain("filterFindingsForDisplay");
  });

  it("keeps source CSS readable instead of storing minified one-line styles", () => {
    const files = [
      "src/entrypoints/options/style.css",
      "src/entrypoints/popup/style.css",
      "src/entrypoints/report/style.css",
    ];
    for (const file of files) {
      const lines = readFileSync(join(process.cwd(), file), "utf8").split("\n");
      expect(Math.max(...lines.map((line) => line.length)), `${file} must remain reviewable source CSS`).toBeLessThanOrEqual(160);
      expect(lines.length, `${file} should not collapse into a minified source line`).toBeGreaterThan(20);
    }
  });
  it("does not use extension UI HTML injection or dynamic code execution sinks", () => {
    const files = walkFiles(join(process.cwd(), "src")).filter((file) => /\.(ts|tsx|js|jsx|html|css)$/.test(file));
    const forbiddenPatterns = [
      /dangerouslySetInnerHTML/,
      /\.innerHTML\s*=/,
      /insertAdjacentHTML\s*\(/,
      /\beval\s*\(/,
      /new\s+Function\s*\(/,
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(text), `${file} must not contain ${pattern}`).toBe(false);
      }
    }
  });

  it("keeps content neutralization free of fixed page-visible markers", () => {
    const text = readFileSync(join(process.cwd(), "src", "browser", "scanner", "contentNeutralization.ts"), "utf8");
    expect(text).toContain("WeakMap<Document, HTMLStyleElement>");
    expect(text).not.toContain("css-sentry-neutralization-rules");
    expect(text).not.toContain("data-css-sentry");
    expect(text).not.toContain("style.id");
    expect(text).not.toContain('setAttribute("data-css-sentry"');
  });

  it("documents the self-security safeguards", () => {
    const text = readFileSync(join(process.cwd(), "docs", "SELF_SECURITY.md"), "utf8");
    for (const marker of ["SS-001", "SS-002", "SS-003", "SS-004", "SS-005", "SS-006", "SS-007", "SS-008", "SS-009", "SS-010", "SS-011", "SS-012", "SS-013", "SS-014", "SS-015"]) {
      expect(text).toContain(marker);
    }
    expect(text).toContain("Extension UI injection invariant");
    expect(text).toContain("not CSS-specific");
    expect(text).toContain("Documentation regression prevention");
  });


  it("keeps iframe insertion and source changes as scan rescan triggers", () => {
    const contentText = readFileSync(join(process.cwd(), "src", "entrypoints", "content.ts"), "utf8");
    const controllerText = readFileSync(join(process.cwd(), "src", "browser", "scanner", "documentScanController.ts"), "utf8");
    const schedulerText = readFileSync(join(process.cwd(), "src", "browser", "scanner", "documentScanScheduler.ts"), "utf8");
    expect(contentText).toContain("createDocumentScanController");
    expect(controllerText).toContain("createDebouncedScanScheduler");
    expect(controllerText).toContain("shouldScheduleRescanForMutations");
    expect(controllerText).toContain("RESCAN_ATTRIBUTE_FILTER");
    expect(controllerText).toContain("scanDocumentSafely");
    expect(controllerText).toContain("createPerformanceBudgetSummary");
    expect(schedulerText).toContain("RESCAN_TRIGGER_SELECTOR");
    expect(schedulerText).toContain("iframe[src]");
    expect(schedulerText).toContain("RESCAN_CHARACTER_DATA_ANCESTOR_SELECTOR");
    expect(controllerText).toContain("characterData: true");
    expect(schedulerText).toContain('"src"');
    expect(schedulerText).toContain('"data"');
  });

  it("keeps background subframe navigation coverage as the browser-level fallback for cross-origin frames", () => {
    const backgroundText = readFileSync(join(process.cwd(), "src", "entrypoints", "background.ts"), "utf8");
    const coverageText = readFileSync(join(process.cwd(), "src", "browser", "scanner", "navigationFrameCoverage.ts"), "utf8");
    const summaryText = readFileSync(join(process.cwd(), "src", "browser", "scanner", "coverageSummary.ts"), "utf8");
    expect(backgroundText).toContain("onErrorOccurred");
    expect(backgroundText).toContain("recordSubframeNavigationPartialCoverage");
    expect(backgroundText).toContain("createCrossOriginSubframePartialReport");
    expect(coverageText).toContain("createPartialFrameSummary");
    expect(coverageText).toContain("topLevelOrigin === frameOrigin");
    expect(summaryText).toContain("frame.cross_origin.uninspectable");
  });

  it("keeps Firefox enhanced stylesheet inspection bounded and pass-through safe", () => {
    const text = readFileSync(join(process.cwd(), "src", "browser", "firefox", "enhancedStylesheetInspection.ts"), "utf8");
    expect(text).toContain("maxStyleTextBytes");
    expect(text).toContain("createBoundedResponseCapture");
    expect(text).toContain("filter.write(event.data)");
    expect(text).toContain("disconnectFilter(filter)");
    expect(text).toContain("closeFilter(filter)");
    expect(text).toContain("createPerformanceBudgetSummary");
  });


  it("keeps parsing-phase performance budget checks in the CSS parser authority", () => {
    const parserEntrypointText = readFileSync(join(process.cwd(), "src", "core", "css", "parseCss.ts"), "utf8");
    const parserText = readFileSync(join(process.cwd(), "src", "core", "css", "parser", "parseCss.ts"), "utf8");
    const budgetText = readFileSync(join(process.cwd(), "src", "core", "css", "parser", "parseBudget.ts"), "utf8");
    const sourceParserText = readFileSync(join(process.cwd(), "src", "core", "css", "parser", "fallbackCssParser.ts"), "utf8");
    const importRecoveryText = readFileSync(join(process.cwd(), "src", "core", "css", "parser", "importRecovery.ts"), "utf8");
    const analyzerText = readFileSync(join(process.cwd(), "src", "core", "analyzer", "analyzeStylesheet.ts"), "utf8");
    expect(parserEntrypointText).toContain('from "./parser/parseCss"');
    expect(parserText).toContain("parseCssWithBudget");
    expect(parserText).toContain("parseLargeStylesheetCssWithBudget");
    expect(parserText).toContain("supplementMissingNestedSecurityRules");
    expect(parserText).toContain("mayContainNestedSecurityRule");
    expect(parserText).not.toContain("options.largeSourceScan || hasNestedStyleRuleContext(rules)");
    expect(budgetText).toContain("isParseBudgetExceeded");
    expect(sourceParserText).toContain("findMatchingBrace(input: string, openIndex: number, budget?: ParseBudgetState)");
    expect(importRecoveryText).toContain("addRecoveredImportRules");
    expect(importRecoveryText).not.toContain("isParseBudgetExceeded");
    expect(analyzerText).toContain("parseResult.budgetExceeded");
    expect(analyzerText).toContain("securityCriticalRulesFromBudgetedParse");
    expect(analyzerText).toContain("securityCriticalRulesSupplementedParse");
    expect(analyzerText).toContain("prioritizeSecurityCriticalParsedRules");
  });

  it("keeps manifest permissions aligned with the documented browser-specific minimal set", async () => {
    const config = readFileSync(join(process.cwd(), "wxt.config.ts"), "utf8");
    expect(config).toContain('const BASE_PERMISSIONS = ["storage", "declarativeNetRequest", "webNavigation"] as const');
    expect(config).toContain('const ALL_URLS_HOST_PERMISSIONS = ["<all_urls>"] as const');
    expect(config).toContain('const FIREFOX_ENHANCED_PERMISSIONS_MV2 = ["webRequest", "webRequestBlocking"] as const');
    expect(config).toContain('const FIREFOX_ENHANCED_PERMISSIONS_MV3 = ["webRequest", "webRequestBlocking", "webRequestFilterResponse"] as const');
    expect(config).toContain('browser === "firefox"');
    expect(config).toContain("manifestVersion === 3");
    expect(config).toContain("manifestVersion === 3 ? [...BASE_PERMISSIONS, ...firefoxPermissions] : [...BASE_PERMISSIONS, ...firefoxPermissions, ...ALL_URLS_HOST_PERMISSIONS]");
    expect(config).toContain("host_permissions: manifestVersion === 3 ? [...ALL_URLS_HOST_PERMISSIONS] : undefined");
    expect(config).not.toContain('permissions: ["storage", "declarativeNetRequest", "webNavigation", "webRequest"]');
    expect(config).not.toContain('"activeTab"');
    expect(config).not.toContain('"scripting"');
    expect(config).not.toContain("optional_host_permissions");
  });


  it("keeps Vitest browser mock and React UI state isolated between tests", () => {
    const setupText = readFileSync(join(process.cwd(), "tests", "setup", "vitest.setup.ts"), "utf8");
    expect(setupText).toContain('import { browser } from "wxt/browser";');
    expect(setupText).toContain("function resetAliasedBrowserMock(): void");
    expect(setupText).toContain("resetAliasedBrowserMock();");
    expect(setupText).toContain("cleanup();");
    expect(setupText).toContain("afterEach(() =>");
    expect(setupText).not.toContain('from "./browser-mock"');
    expect(setupText).not.toContain("beforeEach(() => { __resetBrowserMock(); });");
  });

  it("keeps generated JavaScript setup artifacts out of tests/setup", () => {
    const setupFiles = walkFiles(join(process.cwd(), "tests", "setup"));
    expect(setupFiles.filter((file) => file.endsWith(".js"))).toEqual([]);
  });

  it("keeps DNR mock-private access behind typed test helpers", () => {
    const files = walkFiles(join(process.cwd(), "tests")).filter((file) => /\.(ts|tsx)$/.test(file));
    for (const file of files) {
      if (file.endsWith(join("tests", "setup", "browser-mock.ts")) || file.endsWith(join("tests", "setup", "dnr-test-helpers.ts")) || file.endsWith(join("tests", "integration", "project-structure.test.ts"))) continue;
      const text = readFileSync(file, "utf8");
      expect(text, `${file} should use typed DNR mock helpers`).not.toContain("__getSessionRules");
      expect(text, `${file} should use typed DNR mock helpers`).not.toContain("__setUpdateSessionRulesFailure");
    }
  });

  it("keeps generated manifest, release artifact, AI report, and source CSS verification scripts", () => {
    const manifestScript = readFileSync(join(process.cwd(), "scripts", "verify-generated-manifests.mjs"), "utf8");
    const artifactScript = readFileSync(join(process.cwd(), "scripts", "verify-release-artifacts.mjs"), "utf8");
    const aiReportScript = readFileSync(join(process.cwd(), "scripts", "verify-ai-report-config.mjs"), "utf8");
    const sourceCssScript = readFileSync(join(process.cwd(), "scripts", "verify-source-css-format.mjs"), "utf8");
    expect(manifestScript).toContain("chrome-mv3");
    expect(manifestScript).toContain("firefox-mv2");
    expect(manifestScript).toContain("webRequestBlocking");
    expect(manifestScript).toContain("webRequestFilterResponse");
    expect(artifactScript).toContain(".map");
    expect(artifactScript).toContain("Release artifact output must not contain sourcemaps");
    expect(aiReportScript).toContain("vitest.ai.config.ts");
    expect(aiReportScript).toContain("json-report.json");
    expect(sourceCssScript).toContain("MAX_SOURCE_CSS_LINE_LENGTH");
    expect(sourceCssScript).toContain("Source CSS formatting check passed");
  });



  it("keeps finding-derived DNR URL selection explicit and null-safe", () => {
    const eligibilityText = readFileSync(join(process.cwd(), "src", "browser", "dnr", "findingDnrEligibility.ts"), "utf8");
    const dnrText = readFileSync(join(process.cwd(), "src", "browser", "dnr", "chromeDnr.ts"), "utf8");
    expect(eligibilityText).toContain("export function findingDnrRequestUrl(finding: Finding): string | null");
    expect(eligibilityText).toContain('typeof value === "string" && value.length > 0 ? value : null');
    expect(dnrText).not.toContain("as string");
    expect(dnrText).not.toContain("Boolean(finding.destinationUrl)");
  });

  it("keeps nullable URL parsing guards explicit before DNR URL property access", () => {
    const chromeText = readFileSync(join(process.cwd(), "src", "browser", "dnr", "chromeDnr.ts"), "utf8");
    const targetText = readFileSync(join(process.cwd(), "src", "browser", "dnr", "dnrTargetPreparation.ts"), "utf8");
    expect(targetText).toContain("export function isHttpUrl(value: URL | null): value is URL");
    expect(targetText).toContain("if (!isHttpUrl(parsed))");
    expect(chromeText).toContain("findingDnrRequestUrl(finding) !== null");
    expect(targetText).not.toContain("Boolean(url) && /^https?:$/.test(url.protocol)");
    expect(targetText).not.toContain("Boolean(parsed) && /^https?:$/.test(parsed.protocol)");
  });

  it("keeps report storage, retention, capping, merging, policy normalization, and settings import in separate authorities", () => {
    const storageDirectory = join(process.cwd(), "src", "browser", "storage");
    const expectedModules = [
      "reports.ts",
      "reportRetention.ts",
      "reportCapping.ts",
      "reportMerging.ts",
      "policyStore.ts",
      "policyNormalization.ts",
      "settingsImport.ts",
    ];
    for (const file of expectedModules) expect(existsSync(join(storageDirectory, file)), file).toBe(true);

    const reportsText = readFileSync(join(storageDirectory, "reports.ts"), "utf8");
    const retentionText = readFileSync(join(storageDirectory, "reportRetention.ts"), "utf8");
    const cappingText = readFileSync(join(storageDirectory, "reportCapping.ts"), "utf8");
    const mergingText = readFileSync(join(storageDirectory, "reportMerging.ts"), "utf8");
    const policyStoreText = readFileSync(join(storageDirectory, "policyStore.ts"), "utf8");
    const policyNormalizationText = readFileSync(join(storageDirectory, "policyNormalization.ts"), "utf8");
    const settingsImportText = readFileSync(join(storageDirectory, "settingsImport.ts"), "utf8");

    expect(reportsText).toContain("saveFrameReport");
    expect(reportsText).toContain("persistSitePolicy");
    expect(reportsText).toContain("enforceReportRetention");
    expect(reportsText).not.toContain("function normalizePolicy");
    expect(reportsText).not.toContain("function capStoredReport");
    expect(reportsText).not.toContain("function summarizeFrameReports");
    expect(reportsText).not.toContain("function byteLength");
    expect(retentionText).toContain("export function selectReportKeysForRemoval");
    expect(cappingText).toContain("export function capStoredReport");
    expect(mergingText).toContain("export function summarizeFrameReports");
    expect(policyStoreText).toContain("export async function persistSitePolicy");
    expect(policyNormalizationText).toContain("export function normalizePolicy");
    expect(settingsImportText).toContain("export function parseImportedSitePolicy");
  });

  it("keeps DNR rule allocation, target preparation, rule building, update, and status in separate authorities", () => {
    const dnrDirectory = join(process.cwd(), "src", "browser", "dnr");
    const expectedModules = [
      "chromeDnr.ts",
      "dnrRuleAllocation.ts",
      "dnrTargetPreparation.ts",
      "dnrRuleBuilder.ts",
      "dnrRuleUpdate.ts",
      "dnrStatus.ts",
      "findingDnrEligibility.ts",
    ];
    for (const file of expectedModules) expect(existsSync(join(dnrDirectory, file)), file).toBe(true);

    const chromeText = readFileSync(join(dnrDirectory, "chromeDnr.ts"), "utf8");
    const allocationText = readFileSync(join(dnrDirectory, "dnrRuleAllocation.ts"), "utf8");
    const targetText = readFileSync(join(dnrDirectory, "dnrTargetPreparation.ts"), "utf8");
    const builderText = readFileSync(join(dnrDirectory, "dnrRuleBuilder.ts"), "utf8");
    const updateText = readFileSync(join(dnrDirectory, "dnrRuleUpdate.ts"), "utf8");
    const statusText = readFileSync(join(dnrDirectory, "dnrStatus.ts"), "utf8");

    expect(chromeText).toContain("getCurrentSessionRules");
    expect(chromeText).toContain("allocateRuleIds");
    expect(chromeText).toContain("tabScopedRuleIdsInRange");
    expect(chromeText).toContain("applySessionRuleUpdate");
    expect(chromeText).toContain("initiatorDomainsForFinding");
    expect(chromeText).toContain("skippedTargets");
    expect(allocationText).toContain("export function createRuleIdAllocator");
    expect(targetText).toContain("export function prepareRequestRuleTarget");
    expect(builderText).toContain("export function buildTabPolicyRules");
    expect(updateText).toContain("export async function applySessionRuleUpdate");
    expect(statusText).toContain("export function skippedTargetReasonCounts");
    expect(builderText).not.toContain("ids[offset++] as number");
    expect(chromeText).not.toContain("TAB_RULE_BUCKETS");
    expect(chromeText).not.toContain("Math.abs(tabId) %");
  });


  it("keeps experimental CSS fingerprinting coverage opt-in and reason-separated", () => {
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "benign", "defensive-css-canary-token.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "css-fingerprinting-media-print-url.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "css-fingerprinting-page-url.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "portswigger-first-line-rendered-text-font.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "portswigger-first-letter-rendered-text-font.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "portswigger-overflow-scroll-font-signal.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "portswigger-script-text-node-font.html"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "portswigger-firefox-n-character-text-font.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "portswigger-firefox-reversed-text-font.css"))).toBe(true);
    expect(existsSync(join(process.cwd(), "tests", "fixtures", "attacks", "fontleak-bounded-ligature-unicode-range.css"))).toBe(true);

    const constants = readProjectFile("src/shared/constants.ts");
    const types = readProjectFile("src/shared/types.ts");
    const analyzer = readProjectFile("src/core/analyzer/stylesheetRuleAnalysis.ts");
    const stylesheetRiskContext = readProjectFile("src/core/analyzer/stylesheetRiskContext.ts");
    const scanDocument = readProjectFile("src/browser/scanner/scanDocument.ts");
    const uiMetadata = readProjectFile("src/shared/uiMetadata.ts");
    const spec = readProjectFile("docs/SPEC.md");
    const cveSpec = readProjectFile("docs/CVE_SPEC.md");

    expect(constants).toContain("enableCssFingerprintingGuard: false");
    expect(types).toContain("privacy.css_fingerprinting.conditional_resource");
    expect(types).toContain("privacy.css_fingerprinting.rendered_text_signal");
    expect(types).toContain("privacy.css_fingerprinting.layout_overflow_signal");
    expect(types).toContain("privacy.css_fingerprinting.text_node_signal");
    expect(analyzer).toContain("enableCssFingerprintingGuard");
    expect(analyzer).toContain("cssFingerprintingRiskForRule");
    expect(analyzer).toContain("hasRenderedTextPseudoElementSignal");
    expect(analyzer).toContain("hasScrollStateSignal");
    expect(analyzer).toContain("hasTextNodeSelectorSignal");
    expect(stylesheetRiskContext).toContain("isGeneratedContentSelector(rule.selector)");
    expect(stylesheetRiskContext).toContain("isTextBearingLeakSelector(rule.selector)");
    expect(scanDocument).toContain("policy?.compatibility.enableCssFingerprintingGuard ?? false");
    expect(uiMetadata).toContain("Enable experimental CSS fingerprinting indicators");
    expect(spec).toContain("Cascading Spy Sheets-style CSS fingerprinting research is tracked as adjacent research");
    expect(spec).toContain("1.0.73 Rendered-Text, Layout, Scroll-State, and Bounded Font-Side-Channel Coverage");
    expect(cveSpec).toContain("Defensive CSS honeytokens and cloned-site canary callbacks");
    expect(cveSpec).toContain("PortSwigger rendered-text, layout, and browser-specific CSS side channels");
  });

  it("keeps badge action API compatibility isolated", () => {
    const path = join(process.cwd(), "src", "browser", "platform", "actionApi.ts");
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");

    expect(text).toContain("browserAction");
    expect(text).toContain("selectBadgeActionApi");
    expect(text).toContain("getBadgeActionApi");

    const backgroundText = readFileSync(join(process.cwd(), "src", "entrypoints", "background.ts"), "utf8");
    expect(backgroundText).toContain("getBadgeActionApi");
    expect(backgroundText).not.toContain("browser.action.setBadgeText");
  });

  it("keeps Firefox runtime e2e coverage Playwright-only", () => {
    const path = join(process.cwd(), "tests", "e2e", "firefox-extension-runtime.spec.ts");
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");

    expect(text).toContain('firefox.launchPersistentContext');
    expect(text).toContain('.output/firefox-mv2');
    expect(text).toContain('installTemporaryAddon');
    expect(text).toContain('css-sentry:test-lab-scan');
    expect(text).toContain('css-sentry:test-lab-report');
    expect(text).not.toMatch(/selenium|webdriver/i);
  });

  it("keeps verify:full strict and dependency versions pinned", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(packageJson.scripts?.["verify:full"]).toBe("pnpm build && pnpm build:firefox && pnpm zip && pnpm zip:firefox && pnpm verify:manifests && pnpm verify:release-artifacts && pnpm verify:ai-report && pnpm verify:source-css && pnpm compile && pnpm test && pnpm setup:e2e:browser && pnpm test:e2e");
    expect(packageJson.scripts?.["verify:full:diagnose"]).toBe("pnpm build; pnpm build:firefox; pnpm zip; pnpm zip:firefox; pnpm verify:manifests; pnpm verify:release-artifacts; pnpm verify:ai-report; pnpm verify:source-css; pnpm compile; pnpm test; pnpm test:ai; pnpm setup:e2e:browser; pnpm test:e2e");
    expect(packageJson.scripts?.["setup:e2e:browser"]).toBe("pnpm exec playwright install chromium firefox");
    expect(packageJson.scripts?.["test:e2e:with-install"]).toBe("pnpm build && pnpm build:firefox && pnpm setup:e2e:browser && pnpm test:e2e");
    expect(packageJson.scripts?.["verify:manifests"]).toBe("node scripts/verify-generated-manifests.mjs");
    expect(packageJson.scripts?.["verify:release-artifacts"]).toBe("node scripts/verify-release-artifacts.mjs");
    expect(packageJson.scripts?.["verify:ai-report"]).toBe("node scripts/verify-ai-report-config.mjs");
    expect(packageJson.scripts?.["verify:source-css"]).toBe("node scripts/verify-source-css-format.mjs");
    for (const [sectionName, dependencies] of Object.entries({ dependencies: packageJson.dependencies ?? {}, devDependencies: packageJson.devDependencies ?? {} })) {
      for (const [dependencyName, version] of Object.entries(dependencies)) {
        expect(version, `${sectionName}.${dependencyName} must not use latest`).not.toBe("latest");
      }
    }
  });

  it("protects documentation from destructive summary regressions", () => {
    const requiredDocSizes: Record<string, number> = {
      "docs/SPEC.md": 40_000,
      "docs/CVE_SPEC.md": 12_000,
      "docs/STATUS.md": 18_000,
      "docs/SELF_SECURITY.md": 4_000,
      "docs/SECURITY.md": 3_500,
      "docs/PERMISSIONS.md": 2_000,
      "docs/PRIVACY.md": 2_500,
      "docs/RELEASE_NOTES.md": 12_000,
    };

    for (const [file, minimumBytes] of Object.entries(requiredDocSizes)) {
      const path = join(process.cwd(), file);
      const size = statSync(path).size;
      expect(size, `${file} must not be replaced by a thin summary`).toBeGreaterThanOrEqual(minimumBytes);
    }

    const spec = readFileSync(join(process.cwd(), "docs", "SPEC.md"), "utf8");
    const status = readFileSync(join(process.cwd(), "docs", "STATUS.md"), "utf8");
    const checklist = readFileSync(join(process.cwd(), "docs", "RELEASE_CHECKLIST.md"), "utf8");

    const cveSpec = readFileSync(join(process.cwd(), "docs", "CVE_SPEC.md"), "utf8");
    const releaseNotes = readFileSync(join(process.cwd(), "docs", "RELEASE_NOTES.md"), "utf8");

    expect(spec).toContain("Documentation and Regression Preservation Requirements");
    expect(spec).toContain("Supplemental Historical Issue Coverage");
    expect(spec).toContain("Historical Issue Preservation Requirement");
    expect(status).toContain("documentation restoration");
    expect(status).toContain("Implementation Coverage Index");
    expect(status).toContain("Historical Issue Coverage Tracking");
    expect(checklist).toContain("Documentation Regression Guard");
    expect(checklist).toContain("Documentation Role and Coverage Checks");
    expectNoRepeatedTimestampCorruption("docs/RELEASE_CHECKLIST.md", checklist);
    expectNoRepeatedTimestampCorruption("docs/RELEASE_NOTES.md", releaseNotes);
    expect(cveSpec).toContain("1.0.4 CVE Traceability Preservation Update");
    expect(cveSpec).toContain("1.0.5 CVE-2026-40301");
    expect(spec).toContain("1.0.6 Clean Code, UI Composition, and Scope-Tracking Addendum");
    expect(spec).toContain("1.0.7 Scope, Search Triage, and Fixture-Growth Addendum");
    expect(cveSpec).toContain("1.0.6 Adjacent CVE and Out-of-Scope Classification Update");
    expect(cveSpec).toContain("1.0.7 Search Triage and Added CVE/Advisory Classes");
    expect(status).toContain("1.0.6 maintenance, assets, UI refactor, and out-of-scope tracking");
    expect(status).toContain("1.0.7 search triage, fixture expansion, and status wording cleanup");
    expect(checklist).toContain("1.0.6 Additional Maintenance Checks");
    expect(checklist).toContain("1.0.7 Additional Search and Fixture Checks");
    expect(spec).toContain("1.0.10 Advanced Optional Coverage Requirements");
    expect(spec).toContain("1.0.21 Large-Stylesheet Source Scan Requirement");
    expect(spec).toContain("1.0.27 Inline Conditional CSS and Font Side-Channel Requirements");
    expect(spec).toContain("1.0.28");
    expect(spec).toContain("1.0.29 Fontleak Ligature Evidence Parsing Correction");
    expect(spec).toContain("1.0.30 DNR Action Semantics and Popup Clarity Correction");
    expect(spec).toContain("content-level neutralization");
    expect(spec).toContain("1.0.32 Neutralization and DNR Composition Requirement");
    expect(spec).toContain("1.0.33 Advisory Coverage and Firefox Enhanced Inspection Requirements");
    expect(spec).toContain("1.0.34 Hono and Tandoor Advisory Traceability Requirements");
    expect(spec).toContain("1.0.35 Settings Implementation and Privacy-Invariant Correction");
    expect(spec).toContain("1.0.36 Partial-Analysis E2E and Fixture-Corpus Verification Requirement");
    expect(spec).toContain("1.0.37 Iframe Mutation Rescan Requirement");
    expect(spec).toContain("1.0.38 Browser Navigation Partial-Frame Coverage Fallback Requirement");
    expect(spec).toContain("1.0.39 Release Hardening and Settings Semantics Requirement");
    expect(spec).toContain("1.0.40 DNR Eligibility Regression Correction Requirement");
    expect(spec).toContain("1.0.41 DNR Effective-Request URL Reporting Requirement");
    expect(spec).toContain("1.0.42 Firefox, DNR, Performance, Advisory, and Artifact Hardening Requirement");
    expect(status).toContain("1.0.10 Advanced SVG, Firefox, and Diagnostics Options");
    expect(status).toContain("1.0.21 Exploit-Resistance Review");
    expect(status).toContain("1.0.39 Release hardening");
    expect(status).toContain("1.0.40 DNR eligibility correction");
    expect(status).toContain("1.0.41 DNR effective-request URL reporting correction");
    expect(status).toContain("1.0.42 Firefox, DNR, Performance, Advisory, and Artifact Hardening");
    expect(cveSpec).toContain("1.0.10 Advanced Optional CVE Coverage Policy");
    expect(cveSpec).toContain("1.0.27 CVE and Research Traceability Update");
    expect(cveSpec).toContain("Mermaid CSS injection advisory coverage");
    expect(cveSpec).toContain("justhtml sanitizer bypass advisory coverage");
    expect(cveSpec).toContain("XWiki CVE-2026-26000 classification");
    expect(cveSpec).toContain("Hono CVE-2026-44458 inline-style declaration injection coverage");
    expect(cveSpec).toContain("Tandoor CVE-2026-35046 fixture-backed coverage");
    expect(cveSpec).toContain("FreeScout CVE-2026-40497 fixture-backed coverage");
    expect(releaseNotes).toContain("## 1.0.10");
    expect(releaseNotes).toContain("## 1.0.21");
    expect(releaseNotes).toContain("## 1.0.27");
    expect(releaseNotes).toContain("## 1.0.39");
    expect(releaseNotes).toContain("## 1.0.40");
    expect(releaseNotes).toContain("## 1.0.41");
    expect(releaseNotes).toContain("## 1.0.42");
    expect(releaseNotes).toContain("## 1.0.28");
    expect(releaseNotes).toContain("## 1.0.29");
    expect(releaseNotes).toContain("## 1.0.30");
    expect(releaseNotes).toContain("## 1.0.31");
    expect(releaseNotes).toContain("## 1.0.32");
    expect(releaseNotes).toContain("## 1.0.33");
    expect(releaseNotes).toContain("## 1.0.34");
    expect(releaseNotes).toContain("## 1.0.35");
    expect(releaseNotes).toContain("## 1.0.36");
    expect(releaseNotes).toContain("## 1.0.37");
    expect(releaseNotes).toContain("## 1.0.38");
    expect(status).toContain("1.0.31 Audit Note");
    expect(status).toContain("1.0.32 Audit Note");
    expect(status).toContain("1.0.33 Audit Note");
    expect(status).toContain("1.0.34 Audit Note");
    expect(status).toContain("1.0.35 Audit Note");
    expect(status).toContain("1.0.36 Audit Note");
    expect(status).toContain("1.0.37 Audit Note");
    expect(status).toContain("1.0.38 Audit Note");
    expect(status).toContain("## Features Avoided");
    expect(status).not.toContain("## Features Avoided for v1");
    expect(status).not.toContain("| CI workflow |");
    expect(status).toContain("Covered for documented scope");
    expect(status).not.toContain("Covered for v1 scope");
    expect(status).toContain("Historical Issue Comment Audit");
    expect(status).toContain("Supposed / Known Limitations To Preserve");
    expect(releaseNotes).toContain("## 1.0.5");
    expect(releaseNotes).toContain("## 1.0.4");
    expect(releaseNotes).toContain("## 0.0.23");
    expect(releaseNotes).toContain("## 0.0.1 through 0.0.17");
  });

  it("uses symmetric test isolation against the aliased browser mock instance", () => {
    const setupSource = readProjectFile("tests/setup/vitest.setup.ts");
    expect(setupSource).toContain('import { browser } from "wxt/browser";');
    expect(setupSource).toContain("resetAliasedBrowserMock();");
    expect(setupSource).toContain("beforeEach(() =>");
    expect(setupSource).toContain("afterEach(() =>");
    expect(setupSource).toContain("cleanup();");
    expect(setupSource).not.toContain('from "./browser-mock"');
    const mockSource = readProjectFile("tests/setup/browser-mock.ts");
    expect(mockSource).toContain("__resetBrowserMock(): void { resetBrowserMockState(); }");
  });


  // it("keeps the website Turnstile client/server setup and dynamic CSS rescan path aligned", () => {
  //   const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "website-cloudflare.yml"), "utf8");
  //   const runner = readFileSync(join(process.cwd(), "website", "src", "pages", "tests", "index.astro"), "utf8");
  //   const protocol = readFileSync(join(process.cwd(), "website", "src", "lib", "testProtocol.ts"), "utf8");
  //   const turnstile = readFileSync(join(process.cwd(), "website", "src", "lib", "server", "turnstile.ts"), "utf8");

  //   expect(protocol).toContain('TURNSTILE_TEST_LAB_ACTION = "test_lab_session"');
  //   expect(runner).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  //   expect(runner).toContain("turnstileToken");
  //   expect(runner).toContain("style.textContent = css;\n            document.head.appendChild(style);");
  //   expect(turnstile).toContain("siteverify-action-mismatch");
  //   expect(turnstile).toContain("siteverify-hostname-mismatch");
  //   expect(workflow).toContain("PUBLIC_TURNSTILE_SITE_KEY");
  //   expect(workflow).toContain("TURNSTILE_SITE_KEY");
  // });

});
