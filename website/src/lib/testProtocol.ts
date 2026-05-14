import { TEST_CASES, isKnownModeId, isKnownTestCaseId, testCaseById, type ModeId, type TestCaseId } from "../data/testCases";

export const TEST_SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/i;
export const DEFAULT_TEST_CASE_IDS = TEST_CASES.filter((testCase) => testCase.defaultEnabled).map((testCase) => testCase.id) as readonly TestCaseId[];
export const DEFAULT_MODE: ModeId = "not-sure";
const LOCAL_TEST_LAB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalTestLabOrigin(hostname: string): boolean {
  return LOCAL_TEST_LAB_HOSTS.has(hostname);
}

export function isValidTestSessionId(value: string | null): value is string {
  return typeof value === "string" && TEST_SESSION_ID_PATTERN.test(value);
}

export function parseRequestedMode(value: string | null): ModeId {
  return value && isKnownModeId(value) ? value : DEFAULT_MODE;
}

export function parseRequestedCaseList(value: string | null): TestCaseId[] {
  if (!value) return [...DEFAULT_TEST_CASE_IDS];
  const parsed: TestCaseId[] = [];
  for (const rawCaseId of value.split(",")) {
    const caseId = rawCaseId.trim();
    if (!isKnownTestCaseId(caseId) || parsed.includes(caseId)) continue;
    parsed.push(caseId);
  }
  return parsed.length > 0 ? parsed : [...DEFAULT_TEST_CASE_IDS];
}

export function parseRequestedCaseId(value: string | undefined): TestCaseId | null {
  return value && isKnownTestCaseId(value) ? value : null;
}

export function serializeCaseList(cases: readonly TestCaseId[]): string {
  return cases.join(",");
}

export function endpointUrl(origin: string, testCase: TestCaseId, sessionId: string): string {
  const definition = testCaseById(testCase);
  return new URL(definition.controlledRequestPath.replace("SESSION_ID", sessionId), origin).href;
}

export function visibleCssForTestCase(testCase: TestCaseId, sessionId: string, origin: string): string {
  return testCaseById(testCase).userVisibleCss
    .replaceAll("SESSION_ID", sessionId)
    .replaceAll("ENDPOINT_URL", endpointUrl(origin, testCase, sessionId));
}

export function buildControlledTestCss(sessionId: string, cases: readonly TestCaseId[], origin = "http://localhost"): string {
  const importRules: string[] = [];
  const rules: string[] = [];

  for (const testCase of cases) {
    appendCaseCss(testCase, sessionId, origin, importRules, rules);
  }

  return [...importRules, ...rules].join("\n");
}

function appendCaseCss(testCase: TestCaseId, sessionId: string, origin: string, importRules: string[], rules: string[]): void {
  const endpoint = endpointUrl(origin, testCase, sessionId);
  const importProbeUrl = new URL(`/test-assets/import-probe.css?session=${sessionId}`, origin).href;

  switch (testCase) {
    case "known-detector-smoke":
      rules.push(`#css-sentry-fixtures input[value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "selector-exact":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value="CSS-SENTRY-SENTINEL-ALPHA-12345"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "selector-prefix":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value^="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "selector-suffix":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value$="12345"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "attribute-selector":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "repeated-selector":
      rules.push([
        `#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`,
        `#css-sentry-fixtures input[name="session_token"][value*="12345"] ~ #css-sentry-visible-probe { mask-image: url("${endpoint}"); }`,
        `#css-sentry-fixtures input[name="recovery_code"][value*="RECOVERY"] ~ #css-sentry-visible-probe { background-image: image-set(url("${endpoint}") 1x); }`,
      ].join("\n"));
      return;
    case "relational-has":
      rules.push(`#css-sentry-fixtures:has(input[name="session_token"][value*="CSS-SENTRY-SENTINEL"]) #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "background-image-sink":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "mask-image-sink":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { mask-image: url("${endpoint}"); }`);
      return;
    case "image-set-sink":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: image-set(url("${endpoint}") 1x); }`);
      return;
    case "import-rule":
      importRules.push(`@import url("${importProbeUrl}");`);
      return;
    case "supports-wrapper":
      rules.push(`@supports (display: grid) { #css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); } }`);
      return;
    case "media-wrapper":
      rules.push(`@media screen { #css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); } }`);
      return;
    case "nested-selector":
      rules.push(`#css-sentry-fixtures { & input[name="session_token"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); } }`);
      return;
    case "layer-wrapper":
      rules.push(`@layer css-sentry-lab { #css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); } }`);
      return;
    case "large-stylesheet":
      rules.push(`${largeBenignPrefix()}\n#css-sentry-fixtures input[name="recovery_code"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`);
      return;
    case "large-import":
      importRules.push(`@import url("${importProbeUrl}&variant=large-import");`);
      rules.push(largeBenignPrefix());
      return;
    case "custom-property-sink":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { --css-sentry-controlled-url: url("${endpoint}"); background-image: var(--css-sentry-controlled-url); }`);
      return;
    case "var-fallback-chain":
      rules.push(`#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: var(--css-sentry-missing-url, url("${endpoint}")); }`);
      return;
    case "inline-attr-if":
      rules.push(`#css-sentry-fixtures [data-lab-token="CSS-SENTRY-SENTINEL-ALPHA-12345"] { --css-sentry-lab-value: attr(data-lab-token); background-image: url("${endpoint}"); }`);
      return;
    case "remote-font-signal":
      rules.push(`@font-face { font-family: "CssSentryControlledFont"; src: url("${endpoint}") format("woff2"); unicode-range: U+0041; } #css-sentry-fixtures input[name="session_token"] ~ #css-sentry-visible-probe { font-family: "CssSentryControlledFont", sans-serif; }`);
      return;
    case "font-measurement-container":
      rules.push(`@font-face { font-family: "CssSentryControlledFont"; src: url("${endpoint}") format("woff2"); unicode-range: U+0041; } .css-sentry-font-measure-container { container-type: inline-size; } #css-sentry-fixtures input[name="session_token"] ~ #css-sentry-visible-probe { font-family: "CssSentryControlledFont", sans-serif; }`);
      return;
  }
}

function largeBenignPrefix(): string {
  return Array.from({ length: 1200 }, (_, index) => `.css-sentry-benign-${index}{display:block}`).join("\n");
}
