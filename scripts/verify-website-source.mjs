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

const astroConfig = read("website/astro.config.mjs");
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
const controlledCssEndpoint = read("website/src/pages/api/controlled-css/[sessionId].css.ts");
const css = read("website/src/styles/global.css");
const contentScript = read("src/entrypoints/content.ts");
const background = read("src/entrypoints/background.ts");
const diagnostics = read("src/browser/scanner/testLabDiagnostics.ts");
const scheduler = read("src/browser/scanner/documentScanScheduler.ts");
const controller = read("src/browser/scanner/documentScanController.ts");
const turnstile = read("website/src/lib/server/turnstile.ts");
const workflow = read(".github/workflows/website-cloudflare.yml");
const scanController = read("src/browser/scanner/documentScanController.ts");
const cssTextHelpers = read("src/core/css/text.ts");
const redaction = read("src/core/privacy/redaction.ts");
const websitePlan = read("docs/website/TEST_LAB_OVERHAUL_PLAN.md");
const statusWebsite = read("docs/STATUS_WEBSITE.md");
const coverageControl = existsSync(join(root, "docs/website/TEST_LAB_COVERAGE_CONTROL.md")) ? read("docs/website/TEST_LAB_COVERAGE_CONTROL.md") : "";

expect(!astroConfig.includes("output: 'server'") && !astroConfig.includes('output: "server"'), "website must not server-render every page by default");
expect(astroConfig.includes("@astrojs/cloudflare"), "website must keep the Cloudflare adapter for dynamic endpoints");
expect(index.includes("export const prerender = true"), "home page must be statically prerendered");
expect(testsIndex.includes("export const prerender = true"), "guided /tests runner page must be statically prerendered");
expect(historyPage.includes("export const prerender = true"), "history page must be statically prerendered");
expect(troubleshootingPage.includes("export const prerender = true"), "troubleshooting page must be statically prerendered");
expect(testRedirect.includes("export function getStaticPaths") && testRedirect.includes("export const prerender = true"), "individual test redirects must be statically generated");
expect(testRedirect.includes("window.location.replace") && !testRedirect.includes("Astro.redirect"), "individual test pages must use static client redirects, not request-time Astro redirects");

expect(!sessionEndpoint.includes("locals.runtime"), "session endpoint must not use removed Astro.locals.runtime API");
expect(sessionEndpoint.includes('from "cloudflare:workers"'), "session endpoint must import Cloudflare env from cloudflare:workers");
expect(turnstile.includes("TURNSTILE_SECRET_KEY"), "Turnstile server validation must read the Worker secret binding");
expect(turnstile.includes("siteverify-action-mismatch") && turnstile.includes("siteverify-hostname-mismatch"), "Turnstile server validation must bind tokens to the Test Lab action and request hostname");
expect(workflow.includes("PUBLIC_TURNSTILE_SITE_KEY"), "website deploy workflow must pass the public Turnstile site key to the Astro build");
expect(existsSync(join(root, "website/src/pages/api/hit/[caseId].woff2.ts")), "remote font test must have a font hit endpoint");
expect(existsSync(join(root, "website/src/pages/api/controlled-css/[sessionId].css.ts")), "static runner must use a dynamic controlled CSS endpoint");
expect(controlledCssEndpoint.includes("export const prerender = false"), "controlled CSS endpoint must remain dynamic");
expect(controlledCssEndpoint.includes("buildControlledTestCss") && controlledCssEndpoint.includes("parseRequestedCaseList"), "controlled CSS endpoint must use the shared test protocol and selected cases");
expect(existsSync(join(root, "website/src/pages/tests/index.astro")), "guided /tests runner must exist");
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
expect(testCases.includes('id: "large-stylesheet"') && testCases.includes('riskClass: "large stylesheet late selector probe"') && testCases.includes('defaultEnabled: false'), "large stylesheet stress case must stay available but out of the default selected run");
expect(testProtocol.includes('const importRules: string[] = []'), "CSS generation must keep @import rules separate from normal rules");
expect(testProtocol.includes("appendCaseCss"), "controlled CSS generation must be centralized per test case");
expect(testProtocol.includes("testLabDiagnosticOrigin") && testProtocol.includes("css-sentry-test-lab."), "test protocol must classify supported local and public diagnostic origins");
expect(testProtocol.includes("large-import") && testProtocol.includes("variant=large-import"), "large import check must use an explicit imported stylesheet variant");
expect(index.includes("guided test runner") && index.includes("Coverage groups"), "home page must route to the runner and coverage groups");
expect(testsIndex.includes('id = "initial-test-style"') || testsIndex.includes('id="initial-test-style"'), "runner must add a controlled stylesheet with the initial-test-style identifier");
expect(testsIndex.includes("/api/controlled-css/") && testsIndex.includes("document.head.appendChild(link)"), "static runner must create the selected controlled stylesheet before parsing completes");
expect(testsIndex.includes("css-sentry:test-lab-scan"), "runner must listen for scan diagnostics");
expect(testsIndex.includes("css-sentry:test-lab-report"), "runner must listen for report-save diagnostics");
expect(testsIndex.includes("data-css-sentry-test-lab-scan") && testsIndex.includes("applyStoredDiagnostics"), "runner must recover diagnostic state stored before page listeners attach");
expect(testsIndex.includes("MutationObserver") && testsIndex.includes("observeStoredDiagnostics"), "runner must observe diagnostic attributes written after page listeners attach");
expect(testsIndex.includes('window.addEventListener("message"') && testsIndex.includes('source !== diagnosticMessageSource'), "runner must accept the extension-to-page postMessage diagnostic channel");
expect(testsIndex.includes("scan-disabled"), "runner must distinguish CSS Sentry present-but-not-scanning from missing extension signals");
expect(testsIndex.includes("Manual mode override"), "manual mode selector must be fallback/override, not primary UX");
expect(testsIndex.includes("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"), "runner must load Turnstile explicit rendering when a site key is configured");
expect(testsIndex.includes("turnstileToken"), "runner must send Turnstile tokens to the session endpoint when Turnstile is configured");
expect(testsIndex.includes("TURNSTILE_TEST_LAB_ACTION"), "runner must use the same Turnstile action validated by the session endpoint");
expect(testsIndex.includes("window.history.pushState") && !testsIndex.includes("window.location.assign(url)"), "start selected checks must not refresh the Test Lab page");
expect(testsIndex.includes("dynamic-test-style") && testsIndex.includes("injectControlledStylesheet"), "runner must inject controlled CSS dynamically after session creation");
expect(testsIndex.includes("Detected extension mode"), "runner must display detected extension mode");
expect(testsIndex.includes("data-endpoint-state"), "runner must show per-check endpoint state");
expect(testsIndex.includes("data-manual-state"), "runner must show per-check manual report state");
expect(testsIndex.includes("category-button"), "runner must provide category selection controls");
expect(resultEndpoint.includes("cases") && resultEndpoint.includes("parseResultCases"), "result endpoint must support multi-case polling");
expect(resultInterpretation.includes("report was not saved") && resultInterpretation.includes("connected-no-findings"), "interpretation engine must distinguish scanner, report, and detector-gap states");
expect(contentScript.includes("publishTestLabScanDiagnostic") && contentScript.includes("publishTestLabReportDiagnostic"), "content script must publish scan and report diagnostics separately");
expect(scanController.includes("scanDocumentSafely") && scanController.includes("createPerformanceBudgetSummary"), "content scan controller must convert runtime scanner failures into bounded partial summaries");
expect(cssTextHelpers.includes("function isHexDigit") && !cssTextHelpers.includes("value.replace(/\\\\([0-9a-fA-F]"), "CSS text helpers must not use recursive-prone global replace for unescaping");
expect(redaction.includes("limitRedactionInput") && redaction.includes("REDACTION_SCAN_MARGIN"), "privacy redaction must bound generated selector text before regex redaction");
expect(contentScript.includes("publishTestLabScanDisabledDiagnostic"), "content script must publish a local Test Lab diagnostic when policy mode disables scanning");
expect(contentScript.includes("DOMContentLoaded") && contentScript.includes("load") && contentScript.includes("publishScanDisabledDiagnosticAtReadyBoundaries"), "scan-disabled diagnostics must retry at document readiness boundaries so the Test Lab marker can be observed");
expect(background.includes("ScanCompleteResponse") && background.includes("scanCompleteResponse"), "background must acknowledge report save with a sanitized scan-complete response");
expect(diagnostics.includes("css-sentry:test-lab-scan") && diagnostics.includes("css-sentry:test-lab-report"), "diagnostic bridge must expose separate scan and report events");
expect(diagnostics.includes("css-sentry-test-lab.") && diagnostics.includes(".workers.dev"), "diagnostic bridge must allow the official Cloudflare Worker Test Lab origin pattern");
expect(diagnostics.includes("data-css-sentry-test-lab-scan") && diagnostics.includes("data-css-sentry-test-lab-report"), "diagnostic bridge must store sanitized local diagnostic details for late page listeners");
expect(diagnostics.includes("DIAGNOSTIC_MESSAGE_SOURCE") && diagnostics.includes("postMessage"), "diagnostic bridge must also use the standard content-script to page-script message channel");
expect(diagnostics.includes("scanSkippedReason") && diagnostics.includes("mode.scan_disabled"), "diagnostic bridge must report scan-disabled mode states without pretending a scan happened");
expect(diagnostics.includes("JSON.stringify(detail)"), "diagnostic bridge must serialize event detail for page/content-script boundary compatibility");
expect(diagnostics.includes("data-css-sentry-test-lab-scan") && diagnostics.includes("postMessage"), "diagnostic bridge must expose sanitized diagnostics through stored attributes and same-origin messages");
expect(!diagnostics.includes("selector:"), "diagnostic payload must not include selector text fields");
expect(diagnostics.includes("destinationUrl") === false, "diagnostic payload must not include destination URLs");
expect(scheduler.includes("RESCAN_CHARACTER_DATA_ANCESTOR_SELECTOR"), "document scheduler must classify dynamic style text mutations as rescan triggers");
expect(controller.includes("characterData: true"), "document scan controller must observe style text changes after a style element already exists");
expect(testsIndex.includes("style.textContent = css;\n            document.head.appendChild(style);"), "runner must populate dynamic test CSS before appending the style element");
expect(historyPage.includes("report") && historyPage.includes("Rerun selection"), "history page must record report-save state and rerun selections");
expect(troubleshootingPage.includes("report save failed") && troubleshootingPage.includes("connected with zero findings") && troubleshootingPage.includes("scanning disabled"), "troubleshooting page must explain scanner/report/detector mismatch and scan-disabled states");
expect(css.includes(".runner-check") && css.includes(".test-result-card"), "runner styles must exist");
expect(!css.includes(".mode-table"), "obsolete mode table styles must not return");
expect(!websitePlan.includes("Last Updated:"), "website overhaul document must not include Last Updated metadata");
expect(websitePlan.includes("static runner") || websitePlan.includes("dynamic endpoints"), "website overhaul document must document static pages plus dynamic endpoints");
expect(!statusWebsite.includes("Last Updated:"), "website status document must not include Last Updated metadata");
expect(statusWebsite.includes("static pages") && statusWebsite.includes("dynamic endpoints"), "website status must document the option-2 deployment shape");
expect(!coverageControl.includes("Last Updated:"), "coverage control document must not include Last Updated metadata");
expect(coverageControl.includes("coverage completion") && coverageControl.includes("not as a page named matrix"), "coverage control document must preserve the no-matrix-page framing");

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Website source checks passed.");
