import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const index = read("website/src/pages/index.astro");
const testsIndex = read("website/src/pages/tests/index.astro");
const testRedirect = read("website/src/pages/tests/[caseId].astro");
const historyPage = read("website/src/pages/history/index.astro");
const troubleshootingPage = read("website/src/pages/troubleshooting/index.astro");
const testCases = read("website/src/data/testCases.ts");
const testProtocol = read("website/src/lib/testProtocol.ts");
const resultInterpretation = read("website/src/lib/resultInterpretation.ts");
const resultEndpoint = read("website/src/pages/api/result/[sessionId].json.ts");
const sessionEndpoint = read("website/src/pages/api/session.json.ts");
const css = read("website/src/styles/global.css");
const contentScript = read("src/entrypoints/content.ts");
const background = read("src/entrypoints/background.ts");
const diagnostics = read("src/browser/scanner/testLabDiagnostics.ts");
const websitePlan = read("docs/website/TEST_LAB_OVERHAUL_PLAN.md");
const coverageControl = existsSync(join(root, "docs/website/TEST_LAB_COVERAGE_CONTROL.md")) ? read("docs/website/TEST_LAB_COVERAGE_CONTROL.md") : "";

expect(!sessionEndpoint.includes("locals.runtime"), "session endpoint must not use removed Astro.locals.runtime API");
expect(sessionEndpoint.includes('from "cloudflare:workers"'), "session endpoint must import Cloudflare env from cloudflare:workers");
expect(existsSync(join(root, "website/src/pages/api/hit/[caseId].woff2.ts")), "remote font test must have a font hit endpoint");
expect(existsSync(join(root, "website/src/pages/tests/index.astro")), "guided /tests runner must exist");
expect(testRedirect.includes("Astro.redirect"), "individual test pages must redirect to the guided runner");
expect(!testRedirect.includes("Endpoint, extension signal, and manual report check"), "individual test page must not keep duplicated runner UI");
expect(existsSync(join(root, "website/src/pages/history/index.astro")), "local history page must exist");
expect(existsSync(join(root, "website/src/pages/troubleshooting/index.astro")), "troubleshooting page must exist");
expect(testCases.includes('"known-detector-smoke"'), "known detector smoke check must exist");
expect(testCases.includes('"selector-exact"') && testCases.includes('"selector-prefix"') && testCases.includes('"selector-suffix"'), "selector family coverage must include exact, prefix, and suffix checks");
expect(testCases.includes('"repeated-selector"') && testCases.includes('"relational-has"'), "basic selector coverage must include repeated probes and :has()");
expect(testCases.includes('"background-image-sink"') && testCases.includes('"mask-image-sink"') && testCases.includes('"image-set-sink"'), "remote sink coverage must include background, mask, and image-set checks");
expect(testCases.includes('"supports-wrapper"') && testCases.includes('"media-wrapper"') && testCases.includes('"layer-wrapper"'), "modern syntax coverage must include supports, media, and layer wrappers");
expect(testCases.includes('"large-import"') && testCases.includes('"var-fallback-chain"') && testCases.includes('"font-measurement-container"'), "expanded advanced coverage cases must exist");
expect(testCases.includes("fixtureReferences") && testCases.includes("riskClass") && testCases.includes("limitations"), "test cases must carry coverage metadata, fixture references, and limitations");
expect(testProtocol.includes('const importRules: string[] = []'), "CSS generation must keep @import rules separate from normal rules");
expect(testProtocol.includes("appendCaseCss"), "controlled CSS generation must be centralized per test case");
expect(testProtocol.includes("large-import") && testProtocol.includes("variant=large-import"), "large import check must use an explicit imported stylesheet variant");
expect(index.includes("guided test runner") && index.includes("Coverage groups"), "home page must route to the runner and coverage groups");
expect(testsIndex.includes('id="initial-test-style"'), "runner must render selected CSS in the initial document");
expect(testsIndex.includes("css-sentry:test-lab-scan"), "runner must listen for scan diagnostics");
expect(testsIndex.includes("css-sentry:test-lab-report"), "runner must listen for report-save diagnostics");
expect(testsIndex.includes("Manual mode override"), "manual mode selector must be fallback/override, not primary UX");
expect(testsIndex.includes("Detected extension mode"), "runner must display detected extension mode");
expect(testsIndex.includes("data-endpoint-state"), "runner must show per-check endpoint state");
expect(testsIndex.includes("data-manual-state"), "runner must show per-check manual report state");
expect(testsIndex.includes("category-button"), "runner must provide category selection controls");
expect(resultEndpoint.includes("cases") && resultEndpoint.includes("parseResultCases"), "result endpoint must support multi-case polling");
expect(resultInterpretation.includes("report was not saved") && resultInterpretation.includes("connected-no-findings"), "interpretation engine must distinguish scanner, report, and detector-gap states");
expect(contentScript.includes("publishTestLabScanDiagnostic") && contentScript.includes("publishTestLabReportDiagnostic"), "content script must publish scan and report diagnostics separately");
expect(background.includes("ScanCompleteResponse") && background.includes("scanCompleteResponse"), "background must acknowledge report save with a sanitized scan-complete response");
expect(diagnostics.includes("css-sentry:test-lab-scan") && diagnostics.includes("css-sentry:test-lab-report"), "diagnostic bridge must expose separate scan and report events");
expect(diagnostics.includes("JSON.stringify(detail)"), "diagnostic bridge must serialize event detail for page/content-script boundary compatibility");
expect(!diagnostics.includes("selector:"), "diagnostic payload must not include selector text fields");
expect(diagnostics.includes("destinationUrl") === false, "diagnostic payload must not include destination URLs");
expect(historyPage.includes("report") && historyPage.includes("Rerun selection"), "history page must record report-save state and rerun selections");
expect(troubleshootingPage.includes("report save failed") && troubleshootingPage.includes("connected with zero findings"), "troubleshooting page must explain scanner/report/detector mismatch states");
expect(css.includes(".runner-check") && css.includes(".test-result-card"), "runner styles must exist");
expect(!css.includes(".mode-table"), "obsolete mode table styles must not return");
expect(websitePlan.includes("Last Updated:"), "website overhaul document must include Last Updated metadata");
expect(websitePlan.includes("main /tests/ runner") || websitePlan.includes("guided /tests/ runner"), "website overhaul document must document the runner model");
expect(coverageControl.includes("Last Updated:"), "coverage control document must exist with Last Updated metadata");
expect(coverageControl.includes("coverage completion") && coverageControl.includes("not as a page named matrix"), "coverage control document must preserve the no-matrix-page framing");

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Website source checks passed.");
