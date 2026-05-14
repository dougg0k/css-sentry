export type ModeId = "not-sure" | "default" | "passive" | "balanced" | "strict" | "trusted" | "paused" | "always_scan_never_sanitize" | "never_scan_never_sanitize";

export interface ModeDefinition {
  readonly id: ModeId;
  readonly label: string;
  readonly shortLabel: string;
  readonly userMeaning: string;
}

export interface ModeExpectation {
  readonly endpoint: string;
  readonly extensionReport: string;
  readonly interpretation: string;
}

export type TestCaseCategory =
  | "setup check"
  | "basic selector probe"
  | "remote request sink"
  | "stylesheet delivery"
  | "modern CSS syntax"
  | "large stylesheet resilience"
  | "declaration indirection"
  | "side-channel indicator";

export type WebsiteTestStatus = "live" | "advanced-live" | "manual-explanation" | "deferred" | "out-of-scope";

export interface TestFixtureValue {
  readonly label: string;
  readonly fieldName: string;
  readonly value: string;
  readonly visibility: "hidden test input" | "visible probe surface" | "visible explanation only";
}

export interface TestCaseDefinition {
  readonly id: string;
  readonly category: TestCaseCategory;
  readonly riskClass: string;
  readonly status: WebsiteTestStatus;
  readonly defaultEnabled: boolean;
  readonly title: string;
  readonly shortTitle: string;
  readonly question: string;
  readonly userGoal: string;
  readonly riskScenario: string;
  readonly fakeData: readonly TestFixtureValue[];
  readonly cssMechanism: string;
  readonly userVisibleCss: string;
  readonly controlledRequestPath: string;
  readonly endpointKind: "image" | "font";
  readonly endpointRequestMeaning: string;
  readonly withoutCssSentry: string;
  readonly expectedCssSentryFindings: readonly string[];
  readonly expectedReportText: string;
  readonly fixtureReferences: readonly string[];
  readonly cveOrSpecReferences: readonly string[];
  readonly extensionCheckInstructions: readonly string[];
  readonly troubleshootingHints: readonly string[];
  readonly technicalDetails: readonly string[];
  readonly limitations: readonly string[];
  readonly modeExpectations: Record<Exclude<ModeId, "not-sure">, ModeExpectation>;
}

export const MODE_DEFINITIONS: readonly ModeDefinition[] = [
  {
    id: "not-sure",
    label: "I am not sure",
    shortLabel: "Not sure",
    userMeaning: "Use only before CSS Sentry reports its mode. Interpretation remains incomplete until the page detects the extension mode or a manual override is selected.",
  },
  {
    id: "default",
    label: "Default",
    shortLabel: "Default",
    userMeaning: "CSS Sentry is using the global default policy for this origin. In the current extension behavior, default mode scans and may mitigate similarly to Balanced mode.",
  },
  {
    id: "passive",
    label: "Passive",
    shortLabel: "Passive",
    userMeaning: "CSS Sentry should record relevant findings. Requests may still reach the controlled endpoint because Passive mode is report-oriented.",
  },
  {
    id: "balanced",
    label: "Balanced",
    shortLabel: "Balanced",
    userMeaning: "CSS Sentry should record relevant findings and may install precise blocking rules after analysis where supported.",
  },
  {
    id: "strict",
    label: "Strict",
    shortLabel: "Strict",
    userMeaning: "CSS Sentry should record relevant findings and apply the strongest available supported mitigation for the current case.",
  },
  {
    id: "always_scan_never_sanitize",
    label: "Always scan, never sanitize",
    shortLabel: "Scan only",
    userMeaning: "CSS Sentry should scan and report while avoiding page-changing sanitization. Endpoint requests can still appear depending on the case.",
  },
  {
    id: "never_scan_never_sanitize",
    label: "Never scan, never sanitize",
    shortLabel: "Never scan",
    userMeaning: "This origin is intentionally excluded from scanning. Endpoint requests may be allowed and findings are not expected.",
  },
  {
    id: "trusted",
    label: "Trusted site",
    shortLabel: "Trusted",
    userMeaning: "The current site is intentionally trusted. Requests may be allowed and findings may be reduced by policy.",
  },
  {
    id: "paused",
    label: "Paused",
    shortLabel: "Paused",
    userMeaning: "CSS Sentry is intentionally inactive. Endpoint requests and missing findings can be expected.",
  },
] as const;

const STANDARD_MODE_EXPECTATIONS: Record<Exclude<ModeId, "not-sure">, ModeExpectation> = {
  default: {
    endpoint: "May be received on first load; may be blocked after analysis",
    extensionReport: "Finding expected",
    interpretation: "Default mode should scan and report the case. It may behave like Balanced mode for mitigation decisions, depending on current settings.",
  },
  passive: {
    endpoint: "May be received",
    extensionReport: "Finding expected",
    interpretation: "A received endpoint request can still be correct in Passive mode. The important result is whether CSS Sentry reports the matching selector and CSS request path.",
  },
  balanced: {
    endpoint: "May be received on first load; may be blocked after analysis",
    extensionReport: "Finding expected",
    interpretation: "Balanced mode should report the case. A request can reach the endpoint on first load, but CSS Sentry should show a finding or a rule-installed action when mitigation applies.",
  },
  strict: {
    endpoint: "Prefer not received when mitigation applies",
    extensionReport: "Finding expected",
    interpretation: "Strict mode should report the case and use stronger blocking or neutralization where the case is supported. A received endpoint with no CSS Sentry finding is unexpected after access and policy are confirmed.",
  },
  always_scan_never_sanitize: {
    endpoint: "May be received",
    extensionReport: "Finding expected",
    interpretation: "This advanced mode should scan and report while avoiding page-changing sanitization. Endpoint requests can still be received.",
  },
  never_scan_never_sanitize: {
    endpoint: "May be received",
    extensionReport: "Not expected",
    interpretation: "This advanced mode intentionally skips scanning and sanitization for the origin. Re-run under Passive, Balanced, or Strict before judging detector behavior.",
  },
  trusted: {
    endpoint: "May be received",
    extensionReport: "May be intentionally absent",
    interpretation: "Trusted-site policy can intentionally allow the request and reduce reporting. Do not compare this result to Balanced or Strict behavior.",
  },
  paused: {
    endpoint: "May be received",
    extensionReport: "Not expected",
    interpretation: "Paused mode intentionally does not protect this context. Endpoint requests and missing findings can be expected.",
  },
};

const TOKEN_FIXTURE: readonly TestFixtureValue[] = [
  { label: "Fake token field", fieldName: "session_token", value: "CSS-SENTRY-SENTINEL-ALPHA-12345", visibility: "hidden test input" },
  { label: "Visible probe surface", fieldName: "css-sentry-visible-probe", value: "The controlled CSS request is applied here when the selected mechanism matches.", visibility: "visible probe surface" },
];

const RECOVERY_FIXTURE: readonly TestFixtureValue[] = [
  { label: "Fake recovery code field", fieldName: "recovery_code", value: "CSS-SENTRY-SENTINEL-RECOVERY-67890", visibility: "hidden test input" },
  { label: "Visible probe surface", fieldName: "css-sentry-visible-probe", value: "The late or indirect rule applies the controlled request here when it matches.", visibility: "visible probe surface" },
];

function caseDefinition(definition: Omit<TestCaseDefinition, "modeExpectations">): TestCaseDefinition {
  return { ...definition, modeExpectations: STANDARD_MODE_EXPECTATIONS };
}

export const TEST_CASES = [
  caseDefinition({
    id: "known-detector-smoke",
    category: "setup check",
    riskClass: "minimal supported selector-plus-request detector path",
    status: "live",
    defaultEnabled: true,
    title: "Known detector smoke check",
    shortTitle: "Known detector",
    question: "Can CSS Sentry see the simplest supported selector-plus-image pattern on this page?",
    userGoal: "Run this first. It proves whether CSS Sentry can scan this Test Lab page before interpreting more specific cases.",
    riskScenario: "A CSS rule checks whether a fake input value contains a sentinel string. If it matches, CSS applies a controlled background image to a visible probe box.",
    fakeData: [
      { label: "Fake input value", fieldName: "value", value: "CSS-SENTRY-SENTINEL-smoke-secret", visibility: "hidden test input" },
      { label: "Visible probe surface", fieldName: "css-sentry-visible-probe", value: "CSS applies the request here after the selector matches.", visibility: "visible probe surface" },
    ],
    cssMechanism: "Attribute substring selector targeting a fake value, then applying a background-image URL to a visible sibling element.",
    userVisibleCss: `#css-sentry-fixtures input[value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/known-detector-smoke.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the selector matches the fake input and the browser requests the controlled image for the visible probe box.",
    withoutCssSentry: "The browser can request the controlled image after the fake selector match.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "selector.form_control", "sink.remote_url"],
    expectedReportText: "Look for a substring selector, a form-control selector, and a remote URL sink connected to the known-detector-smoke endpoint.",
    fixtureReferences: ["value-substring-url.css"],
    cveOrSpecReferences: ["SPEC detector coverage: selector attribute probes and remote URL sinks"],
    extensionCheckInstructions: ["Keep this test page active.", "Open the CSS Sentry popup for this tab.", "Confirm that the page shows a scan signal and, after background storage, a report-saved signal.", "Open the report and search for known-detector-smoke, selector.attribute.substring_match, or sink.remote_url."],
    troubleshootingHints: ["If this check reaches the endpoint but CSS Sentry shows no signal, check extension site access for this origin.", "If the scan signal has zero findings, the website CSS no longer matches the detector and should be treated as a test-definition issue."],
    technicalDetails: ["This is the least abstract check and should be used before the other cases.", "The fake value intentionally contains the sentinel string so the selector match is deterministic."],
    limitations: ["This check only proves the basic Test Lab path; it does not cover every detector class."],
  }),
  caseDefinition({
    id: "selector-exact",
    category: "basic selector probe",
    riskClass: "exact attribute selector probe",
    status: "live",
    defaultEnabled: true,
    title: "Exact fake token selector check",
    shortTitle: "Exact selector",
    question: "Can CSS Sentry identify an exact-value selector aimed at fake sensitive data?",
    userGoal: "Verify the exact-match member of the attribute-selector coverage family.",
    riskScenario: "A CSS selector checks the complete fake token value and applies a controlled request if the value matches exactly.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Exact attribute selector plus background-image URL.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value="CSS-SENTRY-SENTINEL-ALPHA-12345"] ~ #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/selector-exact.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached only when the exact fake token selector matches.",
    withoutCssSentry: "A browser can request the controlled URL after the exact selector match.",
    expectedCssSentryFindings: ["selector.attribute.exact_match", "selector.attribute.sensitive_name", "sink.remote_url"],
    expectedReportText: "Look for exact-match selector handling, session_token, and the selector-exact endpoint.",
    fixtureReferences: ["classic-value-prefix-url.css", "value-substring-url.css"],
    cveOrSpecReferences: ["SPEC detector coverage: attribute selector probes"],
    extensionCheckInstructions: ["Confirm that CSS Sentry reports an attribute selector probe.", "Search the report for selector-exact or selector.attribute.exact_match."],
    troubleshootingHints: ["If substring checks work but this does not, record the exact-match detector family separately."],
    technicalDetails: ["The fake token is static and is not user data."],
    limitations: ["Exact-match detection may be scored differently from substring extraction because it is less efficient for incremental exfiltration."],
  }),
  caseDefinition({
    id: "selector-prefix",
    category: "basic selector probe",
    riskClass: "prefix attribute selector probe",
    status: "live",
    defaultEnabled: true,
    title: "Prefix fake token selector check",
    shortTitle: "Prefix selector",
    question: "Can CSS Sentry identify a prefix selector aimed at fake sensitive data?",
    userGoal: "Verify that prefix probing is treated as a selector probe, not as ordinary styling.",
    riskScenario: "A CSS selector checks whether the fake token begins with a known prefix and applies a controlled request if it matches.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Prefix attribute selector plus background-image URL.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value^="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/selector-prefix.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached when the fake token begins with the sentinel prefix.",
    withoutCssSentry: "A browser can request the controlled URL after the prefix selector match.",
    expectedCssSentryFindings: ["selector.attribute.prefix_match", "selector.attribute.sensitive_name", "sink.remote_url"],
    expectedReportText: "Look for selector.attribute.prefix_match, session_token, and selector-prefix.",
    fixtureReferences: ["classic-value-prefix-url.css"],
    cveOrSpecReferences: ["SPEC detector coverage: attribute selector probes"],
    extensionCheckInstructions: ["Check the report for a prefix-match reason and the controlled endpoint."],
    troubleshootingHints: ["A prefix-specific gap should not be collapsed into the substring case."],
    technicalDetails: ["The selector uses ^= against a deterministic fake token prefix."],
    limitations: ["This is one probe shape inside a larger selector-probe family."],
  }),
  caseDefinition({
    id: "selector-suffix",
    category: "basic selector probe",
    riskClass: "suffix attribute selector probe",
    status: "live",
    defaultEnabled: true,
    title: "Suffix fake token selector check",
    shortTitle: "Suffix selector",
    question: "Can CSS Sentry identify a suffix selector aimed at fake sensitive data?",
    userGoal: "Verify that suffix probing is represented separately from prefix and substring probing.",
    riskScenario: "A CSS selector checks whether the fake token ends with a known suffix and applies a controlled request if it matches.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Suffix attribute selector plus background-image URL.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value$="12345"] ~ #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/selector-suffix.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached when the fake token ends with the expected suffix.",
    withoutCssSentry: "A browser can request the controlled URL after the suffix selector match.",
    expectedCssSentryFindings: ["selector.attribute.suffix_match", "selector.attribute.sensitive_name", "sink.remote_url"],
    expectedReportText: "Look for selector.attribute.suffix_match, session_token, and selector-suffix.",
    fixtureReferences: ["value-substring-url.css"],
    cveOrSpecReferences: ["SPEC detector coverage: attribute selector probes"],
    extensionCheckInstructions: ["Check the report for a suffix-match reason and the controlled endpoint."],
    troubleshootingHints: ["A suffix-specific gap should be tracked separately from generic remote URL detection."],
    technicalDetails: ["The selector uses $= against a deterministic fake token suffix."],
    limitations: ["This does not represent a complete extraction sequence by itself."],
  }),
  caseDefinition({
    id: "attribute-selector",
    category: "basic selector probe",
    riskClass: "substring attribute selector probe",
    status: "live",
    defaultEnabled: true,
    title: "Substring fake token selector check",
    shortTitle: "Substring selector",
    question: "Can CSS test whether a fake recovery token contains a known substring?",
    userGoal: "Understand the classic CSS data-probe shape: a selector checks a fake token value, then a controlled request reveals that the selector matched.",
    riskScenario: "A page contains a token-like value. CSS checks whether that value contains a substring. If the selector matches, CSS loads a controlled URL.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Attribute substring selector plus background-image URL on a visible probe element.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/attribute-selector.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached only when the browser matches the fake token selector and requests the controlled image.",
    withoutCssSentry: "A browser can request the controlled URL after the fake selector match.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "selector.attribute.sensitive_name", "sink.remote_url"],
    expectedReportText: "Look for session_token, substring matching, and the attribute-selector endpoint.",
    fixtureReferences: ["value-substring-url.css", "large-stylesheet-full-source-scan-value-probe.css"],
    cveOrSpecReferences: ["SPEC detector coverage: attribute substring selector probes"],
    extensionCheckInstructions: ["Open CSS Sentry while this test page is active.", "Open the report for this page.", "Search for session_token, selector.attribute.substring_match, or attribute-selector."],
    troubleshootingHints: ["If the endpoint is received but no finding appears in Balanced or Strict mode, confirm extension site access and mode before treating it as a detector issue."],
    technicalDetails: ["The selector targets a fake HTML value attribute that is present in the test page source."],
    limitations: ["This is the canonical selector-probe demonstration, not an exhaustive extraction sequence."],
  }),
  caseDefinition({
    id: "repeated-selector",
    category: "basic selector probe",
    riskClass: "repeated selector probe pattern",
    status: "live",
    defaultEnabled: true,
    title: "Repeated selector probe check",
    shortTitle: "Repeated probes",
    question: "Can CSS Sentry identify repeated fake-value probes in one stylesheet?",
    userGoal: "Verify that a sequence of selector probes is recognized as a pattern rather than isolated styling.",
    riskScenario: "A stylesheet repeats multiple token-value selector checks with separate controlled requests. Repetition increases confidence that the CSS is probing data.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Several attribute selectors with controlled background-image URLs.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe { background-image: url("ENDPOINT_URL"); }
#css-sentry-fixtures input[name="session_token"][value*="12345"] ~ #css-sentry-visible-probe { mask-image: url("ENDPOINT_URL"); }`,
    controlledRequestPath: "/api/hit/repeated-selector.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if any of the repeated fake selectors matches and applies the controlled URL.",
    withoutCssSentry: "A browser can request the controlled URL once the repeated selector pattern matches.",
    expectedCssSentryFindings: ["selector.repeated_probe_pattern", "selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for repeated probe pattern, substring matching, and repeated-selector.",
    fixtureReferences: ["poc-test-1-base64-fragment.css", "remote-base64-fragment.css"],
    cveOrSpecReferences: ["SPEC detector coverage: repeated selector probe indicators"],
    extensionCheckInstructions: ["Check whether CSS Sentry reports repeated probe behavior or multiple selector findings."],
    troubleshootingHints: ["If one selector is reported but repeated-pattern wording is absent, record the distinction instead of marking the whole case as failed."],
    technicalDetails: ["The website uses one endpoint for readability, while the pattern represents multiple probe candidates."],
    limitations: ["This is a compact representation of repetition, not a large generated dictionary attack."],
  }),
  caseDefinition({
    id: "relational-has",
    category: "basic selector probe",
    riskClass: ":has() relational selector probe",
    status: "advanced-live",
    defaultEnabled: false,
    title: "Relational :has() selector check",
    shortTitle: ":has() selector",
    question: "Can CSS Sentry notice a fake-value probe hidden inside a relational selector?",
    userGoal: "Test a modern selector shape after the simpler selector checks work.",
    riskScenario: "A relational selector matches a container only when it contains the fake token input. The controlled request is then applied to the visible probe surface.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: ":has() relational selector plus controlled background-image URL.",
    userVisibleCss: `#css-sentry-fixtures:has(input[name="session_token"][value*="CSS-SENTRY-SENTINEL"]) #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/relational-has.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser supports :has() and the fake token input satisfies the relational selector.",
    withoutCssSentry: "A supporting browser can request the controlled URL after the relational selector matches.",
    expectedCssSentryFindings: ["selector.relational.has", "selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for :has(), selector.relational.has, substring matching, or relational-has.",
    fixtureReferences: ["has-selector-exfil.css"],
    cveOrSpecReferences: ["SPEC detector coverage: relational selector probes"],
    extensionCheckInstructions: ["Run this after the known detector and substring selector checks.", "If the endpoint is not received, confirm browser support for :has() before interpreting the extension result."],
    troubleshootingHints: ["Endpoint absence can mean unsupported selector syntax rather than successful mitigation."],
    technicalDetails: ["This is both a browser selector-support check and a detector check."],
    limitations: ["Unsupported browser syntax makes the endpoint result inconclusive."],
  }),
  caseDefinition({
    id: "background-image-sink",
    category: "remote request sink",
    riskClass: "background-image URL sink",
    status: "live",
    defaultEnabled: true,
    title: "Background image sink check",
    shortTitle: "Background image",
    question: "Can CSS Sentry connect a fake selector match to a background-image request?",
    userGoal: "Verify the most common remote image sink independently from selector family details.",
    riskScenario: "After the fake selector matches, CSS uses background-image to request a controlled resource.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Attribute selector with background-image URL sink.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/background-image-sink.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser requests the controlled background image.",
    withoutCssSentry: "A browser can request the controlled background image after the selector match.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for background-image, a remote URL sink, and background-image-sink.",
    fixtureReferences: ["value-substring-url.css"],
    cveOrSpecReferences: ["SPEC detector coverage: remote URL sinks"],
    extensionCheckInstructions: ["Check the report for remote URL sink wording and the endpoint identifier."],
    troubleshootingHints: ["If selector cases work but this case does not report a sink, inspect declaration parsing."],
    technicalDetails: ["This case isolates the ordinary background-image sink path."],
    limitations: ["It does not test less common image-capable CSS properties."],
  }),
  caseDefinition({
    id: "mask-image-sink",
    category: "remote request sink",
    riskClass: "mask-image URL sink",
    status: "live",
    defaultEnabled: false,
    title: "Mask image sink check",
    shortTitle: "Mask image",
    question: "Can CSS Sentry recognize a controlled request through mask-image?",
    userGoal: "Test a less common image-capable property that can still trigger a request.",
    riskScenario: "After the fake selector matches, CSS uses mask-image to request the controlled resource.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Attribute selector with mask-image URL sink.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe {
  mask-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/mask-image-sink.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser supports mask-image and requests the controlled image.",
    withoutCssSentry: "A supporting browser can request the controlled mask image after the selector match.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for mask-image or a remote URL sink connected to mask-image-sink.",
    fixtureReferences: ["namespace-sanitizer-bypass.css"],
    cveOrSpecReferences: ["SPEC detector coverage: remote URL sinks"],
    extensionCheckInstructions: ["Run this after background-image works.", "If endpoint and extension disagree, record browser support and report terms."],
    troubleshootingHints: ["Endpoint absence can be caused by browser support differences."],
    technicalDetails: ["Mask image support and request behavior can vary by browser."],
    limitations: ["This is an advanced sink check and should not be the first installation diagnostic."],
  }),
  caseDefinition({
    id: "image-set-sink",
    category: "remote request sink",
    riskClass: "image-set() URL sink",
    status: "advanced-live",
    defaultEnabled: false,
    title: "image-set() sink check",
    shortTitle: "image-set()",
    question: "Can CSS Sentry recognize a controlled request inside image-set()?",
    userGoal: "Verify modern image value parsing after ordinary URL sinks work.",
    riskScenario: "A selector match applies an image-set() value that contains the controlled endpoint.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Attribute selector with image-set() background-image value.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe {
  background-image: image-set(url("ENDPOINT_URL") 1x);
}`,
    controlledRequestPath: "/api/hit/image-set-sink.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser selects the controlled image-set candidate.",
    withoutCssSentry: "A supporting browser can request the selected image-set resource after the selector match.",
    expectedCssSentryFindings: ["sink.image_set_remote", "selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for image-set(), sink.image_set_remote, or image-set-sink.",
    fixtureReferences: ["image-set-string-form.css", "inline-style-image-set-url.html"],
    cveOrSpecReferences: ["SPEC detector coverage: image-set remote sinks"],
    extensionCheckInstructions: ["Run this after the ordinary background-image sink works.", "Check whether the report identifies image-set-specific risk or a generic remote sink."],
    troubleshootingHints: ["Browser image-set behavior can affect endpoint results."],
    technicalDetails: ["The check intentionally uses one candidate to keep endpoint interpretation simple."],
    limitations: ["It does not test density selection across multiple image candidates."],
  }),
  caseDefinition({
    id: "import-rule",
    category: "stylesheet delivery",
    riskClass: "same-origin @import delivered probe",
    status: "live",
    defaultEnabled: true,
    title: "Imported stylesheet delivery check",
    shortTitle: "@import delivery",
    question: "Can a CSS @import carry the controlled selector-and-request rule?",
    userGoal: "See that risky CSS does not need to be written directly in the first style block; it can be delivered by an imported stylesheet.",
    riskScenario: "The page stylesheet imports another stylesheet. That imported stylesheet contains the fake-token selector and controlled request.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "@import rule that loads a same-origin stylesheet containing the selector and controlled URL.",
    userVisibleCss: `@import url("/test-assets/import-probe.css?session=SESSION_ID");

/* Imported response contains the selector and ENDPOINT_URL. */`,
    controlledRequestPath: "/api/hit/import-rule.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the imported CSS loads and its selector rule matches the fake token field.",
    withoutCssSentry: "A browser can load the imported CSS and then request the controlled image from the imported rule.",
    expectedCssSentryFindings: ["sink.import_remote", "selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for @import, import-probe.css, import-rule, or selector.attribute.substring_match.",
    fixtureReferences: ["import-exfil.css", "large-stylesheet-full-source-scan-import.css"],
    cveOrSpecReferences: ["SPEC detector coverage: imported stylesheet delivery"],
    extensionCheckInstructions: ["Open CSS Sentry for this page.", "Check whether the report mentions @import or import-probe.css.", "Then check whether the downstream selector request is visible."],
    troubleshootingHints: ["If only the import is reported but the downstream selector is not, record that distinction rather than a clean pass."],
    technicalDetails: ["The generated CSS emits @import before ordinary rules because CSS requires import rules to appear before normal style rules."],
    limitations: ["This variant is same-origin. A cross-origin companion endpoint remains a separate deployment task."],
  }),
  caseDefinition({
    id: "supports-wrapper",
    category: "modern CSS syntax",
    riskClass: "@supports wrapped selector probe",
    status: "live",
    defaultEnabled: false,
    title: "@supports wrapper check",
    shortTitle: "@supports",
    question: "Can CSS Sentry detect a fake-token selector inside @supports?",
    userGoal: "Verify that grouping rules do not hide the selector and sink.",
    riskScenario: "The risky selector is nested inside a feature-support condition.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "@supports wrapper around an attribute selector and URL sink.",
    userVisibleCss: `@supports (display: grid) {
  #css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe {
    background-image: url("ENDPOINT_URL");
  }
}`,
    controlledRequestPath: "/api/hit/supports-wrapper.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the @supports condition is true and the wrapped selector matches.",
    withoutCssSentry: "A browser can request the controlled URL from inside the wrapper.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for @supports context, substring matching, and supports-wrapper.",
    fixtureReferences: ["nested-supports-rule.css", "poc-test-3-supports.css"],
    cveOrSpecReferences: ["SPEC detector coverage: grouping rule wrappers"],
    extensionCheckInstructions: ["Check whether the report preserves the grouped-rule context or at least the selector and URL sink."],
    troubleshootingHints: ["If unwrapped selector cases work but this does not, treat it as grouping-rule coverage."],
    technicalDetails: ["The condition uses a widely supported feature to keep endpoint behavior deterministic."],
    limitations: ["This does not test false @supports branches."],
  }),
  caseDefinition({
    id: "media-wrapper",
    category: "modern CSS syntax",
    riskClass: "@media wrapped selector probe",
    status: "live",
    defaultEnabled: false,
    title: "@media wrapper check",
    shortTitle: "@media",
    question: "Can CSS Sentry detect a fake-token selector inside @media?",
    userGoal: "Verify that media wrappers do not hide the selector and sink.",
    riskScenario: "The risky selector is nested inside a media rule that applies in ordinary screen browsing.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "@media wrapper around an attribute selector and URL sink.",
    userVisibleCss: `@media screen {
  #css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe {
    background-image: url("ENDPOINT_URL");
  }
}`,
    controlledRequestPath: "/api/hit/media-wrapper.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the screen media rule applies and the fake selector matches.",
    withoutCssSentry: "A browser can request the controlled URL from inside the media wrapper.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for @media context, substring matching, and media-wrapper.",
    fixtureReferences: ["nested-media-rule.css", "poc-test-3-1-media.css"],
    cveOrSpecReferences: ["SPEC detector coverage: grouping rule wrappers"],
    extensionCheckInstructions: ["Check whether the report preserves the grouped-rule context or at least the selector and URL sink."],
    troubleshootingHints: ["If the endpoint is not received, confirm the page is rendered as screen media."],
    technicalDetails: ["The rule uses @media screen to keep the browser-side condition simple."],
    limitations: ["This does not test rare media feature combinations."],
  }),
  caseDefinition({
    id: "nested-selector",
    category: "modern CSS syntax",
    riskClass: "nested CSS selector probe",
    status: "live",
    defaultEnabled: true,
    title: "Nested CSS selector check",
    shortTitle: "Nested selector",
    question: "Can the same fake-token selector still be recognized when it is written inside nested CSS syntax?",
    userGoal: "Verify that modern CSS syntax does not make the data-probe selector invisible to analysis.",
    riskScenario: "Nested CSS can make selector logic harder to see in manual review. The controlled selector is nested under a fixture container.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Nested selector with a controlled background-image URL.",
    userVisibleCss: `#css-sentry-fixtures {
  & input[name="session_token"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe {
    background-image: url("ENDPOINT_URL");
  }
}`,
    controlledRequestPath: "/api/hit/nested-selector.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser supports the nested selector and applies the controlled URL.",
    withoutCssSentry: "A browser with nested CSS support can request the controlled image after the nested selector matches.",
    expectedCssSentryFindings: ["css.grouping_rule.nested", "selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for nested grouping, substring matching, or nested-selector.",
    fixtureReferences: ["large-stylesheet-full-source-scan-nested.css", "nested-layer-rule.css"],
    cveOrSpecReferences: ["SPEC detector coverage: nested CSS"],
    extensionCheckInstructions: ["Check CSS Sentry for nested grouping or selector.attribute.substring_match.", "If the endpoint is not received, confirm browser nested-CSS support before interpreting the extension result."],
    troubleshootingHints: ["Endpoint not received can mean the browser did not apply this CSS syntax, not necessarily that CSS Sentry blocked it."],
    technicalDetails: ["This is both a detector check and a browser syntax support check."],
    limitations: ["Unsupported browser syntax makes the endpoint result inconclusive."],
  }),
  caseDefinition({
    id: "layer-wrapper",
    category: "modern CSS syntax",
    riskClass: "@layer wrapped selector probe",
    status: "live",
    defaultEnabled: false,
    title: "@layer wrapper check",
    shortTitle: "@layer",
    question: "Can CSS Sentry detect a fake-token selector inside a cascade layer?",
    userGoal: "Verify that cascade layers preserve detector coverage.",
    riskScenario: "The controlled selector and sink are placed inside an @layer block.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "@layer wrapper around an attribute selector and URL sink.",
    userVisibleCss: `@layer css-sentry-lab {
  #css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe {
    background-image: url("ENDPOINT_URL");
  }
}`,
    controlledRequestPath: "/api/hit/layer-wrapper.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the cascade layer rule applies and the fake selector matches.",
    withoutCssSentry: "A browser can request the controlled URL from inside the layer wrapper.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for @layer context, substring matching, and layer-wrapper.",
    fixtureReferences: ["nested-layer-rule.css"],
    cveOrSpecReferences: ["SPEC detector coverage: grouping rule wrappers"],
    extensionCheckInstructions: ["Check whether CSS Sentry reports the selector and remote sink even inside @layer."],
    troubleshootingHints: ["If browser support or cascade ordering suppresses the rule, endpoint state can be inconclusive."],
    technicalDetails: ["The layer name is intentionally local to the lab."],
    limitations: ["This does not test layer precedence conflicts."],
  }),
  caseDefinition({
    id: "large-stylesheet",
    category: "large stylesheet resilience",
    riskClass: "large stylesheet late selector probe",
    status: "live",
    defaultEnabled: true,
    title: "Large stylesheet late-rule check",
    shortTitle: "Large stylesheet",
    question: "Can CSS Sentry still notice a risky selector near the end of a large stylesheet?",
    userGoal: "Verify that large CSS input does not silently hide a late, security-relevant selector.",
    riskScenario: "A long stylesheet contains many harmless rules before the controlled selector appears near the end.",
    fakeData: RECOVERY_FIXTURE,
    cssMechanism: "Large benign prefix followed by a late attribute substring selector and controlled URL.",
    userVisibleCss: `/* many harmless rules appear first */
.css-sentry-benign-1199 { display: block; }

#css-sentry-fixtures input[name="recovery_code"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe {
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/large-stylesheet.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser reaches and applies the late selector rule.",
    withoutCssSentry: "A browser can request the controlled URL even when the selector appears late in a large CSS file.",
    expectedCssSentryFindings: ["selector.attribute.substring_match", "analysis.skipped.performance_budget", "sink.remote_url"],
    expectedReportText: "Look for recovery_code, large-stylesheet, and possibly a partial-analysis or performance-budget notice.",
    fixtureReferences: ["large-stylesheet-full-source-scan-value-probe.css", "large-stylesheet-full-source-scan-nested.css"],
    cveOrSpecReferences: ["SPEC detector coverage: large stylesheet source scanning"],
    extensionCheckInstructions: ["Run this case alone if the page feels noisy.", "Open CSS Sentry and check whether it reports the late recovery_code selector or a partial-analysis notice."],
    troubleshootingHints: ["If the endpoint is received and no finding appears, this is more likely to be a detector coverage issue than a browser syntax issue."],
    technicalDetails: ["This case verifies resilience and report clarity under a large CSS input."],
    limitations: ["The generated size is intentionally bounded for the public website and does not replace fixture-corpus testing."],
  }),
  caseDefinition({
    id: "large-import",
    category: "large stylesheet resilience",
    riskClass: "large stylesheet late @import recovery",
    status: "advanced-live",
    defaultEnabled: false,
    title: "Large stylesheet late @import check",
    shortTitle: "Large @import",
    question: "Can CSS Sentry preserve late @import visibility when a stylesheet is large?",
    userGoal: "Verify the import-recovery path separately from ordinary late selector scanning.",
    riskScenario: "A large stylesheet includes a late imported stylesheet that carries the controlled selector and request.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Large benign prefix plus an imported stylesheet probe.",
    userVisibleCss: `/* many harmless rules appear first */
.css-sentry-benign-1199 { display: block; }
@import url("/test-assets/import-probe.css?session=SESSION_ID");`,
    controlledRequestPath: "/api/hit/large-import.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the imported probe stylesheet loads and its selector matches.",
    withoutCssSentry: "A browser can load the imported stylesheet and request the controlled image from that response.",
    expectedCssSentryFindings: ["sink.import_remote", "analysis.skipped.performance_budget", "sink.remote_url"],
    expectedReportText: "Look for @import, import-probe.css, late import recovery, or large-import.",
    fixtureReferences: ["large-stylesheet-full-source-scan-import.css"],
    cveOrSpecReferences: ["SPEC detector coverage: import recovery under large input"],
    extensionCheckInstructions: ["Run this separately from the ordinary import check.", "Confirm whether the report includes the late import or a partial-analysis notice."],
    troubleshootingHints: ["If the imported request is received but no report is stored, classify it as report pipeline or import recovery, not as a generic selector failure."],
    technicalDetails: ["CSS import ordering means the public website uses this as an advanced representation; fixture tests remain the canonical large late-import proof."],
    limitations: ["Because CSS @import ordering is strict, this website case cannot perfectly mirror a malformed late @import fixture in every browser."],
  }),
  caseDefinition({
    id: "custom-property-sink",
    category: "declaration indirection",
    riskClass: "custom property URL sink",
    status: "advanced-live",
    defaultEnabled: false,
    title: "Custom property URL indirection check",
    shortTitle: "Custom property",
    question: "Can CSS Sentry connect a URL stored in a CSS custom property to the selector that uses it?",
    userGoal: "See a case where the URL is not written directly in the final network-capable declaration.",
    riskScenario: "A CSS variable holds the controlled URL. The selector applies the variable through background-image after the fake token matches.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "URL-bearing custom property applied through a final background-image declaration.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe {
  --css-sentry-controlled-url: url("ENDPOINT_URL");
  background-image: var(--css-sentry-controlled-url);
}`,
    controlledRequestPath: "/api/hit/custom-property-sink.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser resolves the custom property into the background-image declaration.",
    withoutCssSentry: "A browser can resolve the variable and request the controlled resource after the selector matches.",
    expectedCssSentryFindings: ["css.custom_property.url_sink", "selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for custom-property URL sink, selector.attribute.substring_match, or custom-property-sink.",
    fixtureReferences: ["poc-test-2-css-var-url.css", "inline-style-var-chain-url.html"],
    cveOrSpecReferences: ["SPEC detector coverage: custom property URL sinks"],
    extensionCheckInstructions: ["Run this after the known detector check works.", "Check whether CSS Sentry connects the variable and final URL sink."],
    troubleshootingHints: ["If simpler checks work but this does not, record it as a custom-property coverage gap."],
    technicalDetails: ["This case is optional because it tests data-flow clarity in the CSS analyzer, not the simplest selector mechanism."],
    limitations: ["Browser resolution and analyzer data-flow reporting can differ; compare both endpoint and report details."],
  }),
  caseDefinition({
    id: "var-fallback-chain",
    category: "declaration indirection",
    riskClass: "var() fallback URL chain",
    status: "advanced-live",
    defaultEnabled: false,
    title: "var() fallback URL chain check",
    shortTitle: "var() fallback",
    question: "Can CSS Sentry identify a controlled URL hidden in a var() fallback chain?",
    userGoal: "Test a more indirect declaration path after ordinary custom-property checks work.",
    riskScenario: "A selector applies a background-image value through var() fallback syntax that contains the controlled URL.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Attribute selector with var() fallback carrying a URL sink.",
    userVisibleCss: `#css-sentry-fixtures input[name="session_token"][value*="ALPHA"] ~ #css-sentry-visible-probe {
  background-image: var(--css-sentry-missing-url, url("ENDPOINT_URL"));
}`,
    controlledRequestPath: "/api/hit/var-fallback-chain.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached if the browser uses the URL fallback value.",
    withoutCssSentry: "A browser can request the fallback URL when the custom property is unresolved.",
    expectedCssSentryFindings: ["css.custom_property.unresolved", "selector.attribute.substring_match", "sink.remote_url"],
    expectedReportText: "Look for unresolved custom property, fallback URL, or var-fallback-chain.",
    fixtureReferences: ["poc-test-2-1-css-var-fallback.css", "inline-style-var-chain-url.html"],
    cveOrSpecReferences: ["SPEC detector coverage: unresolved custom property URL fallback"],
    extensionCheckInstructions: ["Check whether CSS Sentry reports the fallback URL rather than only the final computed property."],
    troubleshootingHints: ["If the endpoint is received but no fallback reason appears, record whether a generic URL sink was still reported."],
    technicalDetails: ["The custom property is intentionally undefined so the fallback is used."],
    limitations: ["This tests fallback URL visibility, not all custom property graph shapes."],
  }),
  caseDefinition({
    id: "inline-attr-if",
    category: "declaration indirection",
    riskClass: "inline attr()/if() value source representation",
    status: "manual-explanation",
    defaultEnabled: false,
    title: "attr()/if() value-source representation",
    shortTitle: "attr()/if()",
    question: "Can the lab explain newer value-source patterns without claiming unsupported browser behavior?",
    userGoal: "Review expected report terms for value-source patterns that are better validated through fixtures than a public browser endpoint.",
    riskScenario: "Modern CSS value functions can make sensitive-looking attribute data part of declaration logic. The website provides a controlled representation and points to fixture-backed expectations.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Representative attr()/if() declaration text associated with a controlled URL sink.",
    userVisibleCss: `#css-sentry-fixtures [data-lab-token="CSS-SENTRY-SENTINEL-ALPHA-12345"] {
  --css-sentry-lab-value: attr(data-lab-token);
  background-image: url("ENDPOINT_URL");
}`,
    controlledRequestPath: "/api/hit/inline-attr-if.svg?session=SESSION_ID",
    endpointKind: "image",
    endpointRequestMeaning: "The endpoint is reached for the representative URL sink, while attr()/if() details should be validated against the extension report and fixtures.",
    withoutCssSentry: "A browser can request the controlled URL from the representative declaration path.",
    expectedCssSentryFindings: ["css.value.attr_source", "css.value.conditional_if", "sink.inline_remote_url"],
    expectedReportText: "Look for attr source, conditional if, inline remote URL, or inline-attr-if in fixture-backed reports.",
    fixtureReferences: ["inline-style-attr-if-url.html", "inline-style-attr-if-image-set-string.html", "inline-style-nested-if-chain-url.html"],
    cveOrSpecReferences: ["SPEC detector coverage: inline value-source indicators"],
    extensionCheckInstructions: ["Treat this as a representation first and a browser endpoint check second.", "Use fixture tests for strict acceptance of attr()/if() details."],
    troubleshootingHints: ["Do not mark CSS Sentry failed only because a browser does not apply an experimental value syntax."],
    technicalDetails: ["This case intentionally avoids overclaiming browser support for draft or unevenly implemented value syntax."],
    limitations: ["Manual explanation status: fixture coverage is authoritative for the attr()/if() details."],
  }),
  caseDefinition({
    id: "remote-font-signal",
    category: "side-channel indicator",
    riskClass: "remote font URL signal",
    status: "advanced-live",
    defaultEnabled: false,
    title: "Remote font signal check",
    shortTitle: "Remote font",
    question: "Can CSS Sentry surface a remote-font risk signal near a sensitive selector context?",
    userGoal: "Understand that a remote font request is a risk signal, not by itself proof of a complete data leak.",
    riskScenario: "Remote fonts can participate in CSS side-channel techniques when combined with measurement or conditional rendering. This check only makes that signal visible.",
    fakeData: [
      { label: "Fake token field", fieldName: "session_token", value: "CSS-SENTRY-SENTINEL-ALPHA-12345", visibility: "hidden test input" },
      { label: "Visible probe text", fieldName: "css-sentry-visible-probe", value: "AAAA probe text for the controlled font request.", visibility: "visible probe surface" },
    ],
    cssMechanism: "@font-face source URL plus a sensitive-context font-family reference.",
    userVisibleCss: `@font-face {
  font-family: "CssSentryControlledFont";
  src: url("ENDPOINT_URL") format("woff2");
  unicode-range: U+0041;
}

#css-sentry-fixtures input[name="session_token"] ~ #css-sentry-visible-probe {
  font-family: "CssSentryControlledFont", sans-serif;
}`,
    controlledRequestPath: "/api/hit/remote-font-signal.woff2?session=SESSION_ID",
    endpointKind: "font",
    endpointRequestMeaning: "The endpoint is reached if the browser attempts to fetch the controlled font resource.",
    withoutCssSentry: "A browser may request the font when matching text references the declared font-family.",
    expectedCssSentryFindings: ["sink.font_remote", "sink.font_unicode_range_remote", "sink.font_metric_side_channel"],
    expectedReportText: "Look for remote font, unicode range, or font side-channel indicators. Do not treat this as direct token exfiltration by itself.",
    fixtureReferences: ["font-face-unicode-range-sensitive.css", "fontleak-container-query-url.css"],
    cveOrSpecReferences: ["CVE_SPEC Fontleak-style side-channel coverage"],
    extensionCheckInstructions: ["Run this optional case separately.", "Check whether CSS Sentry reports a remote-font signal rather than a direct token leak."],
    troubleshootingHints: ["A missing endpoint hit can be caused by browser font loading behavior or cache state."],
    technicalDetails: ["This is a representation of a side-channel indicator, not a full side-channel measurement."],
    limitations: ["Endpoint state is less stable for fonts than image sinks because browser font loading and caching can vary."],
  }),
  caseDefinition({
    id: "font-measurement-container",
    category: "side-channel indicator",
    riskClass: "font measurement container signal",
    status: "manual-explanation",
    defaultEnabled: false,
    title: "Font measurement container signal check",
    shortTitle: "Font measurement",
    question: "Can the lab explain font measurement indicators without claiming a full side-channel proof?",
    userGoal: "Understand the difference between a risk indicator and a complete exploit measurement.",
    riskScenario: "A side-channel technique may combine remote fonts, container sizing, and measurement-sensitive rendering. The website represents the pieces without performing a real measurement attack.",
    fakeData: TOKEN_FIXTURE,
    cssMechanism: "Container-style representation combined with remote-font indicator terms.",
    userVisibleCss: `.css-sentry-font-measure-container { container-type: inline-size; }
#css-sentry-fixtures input[name="session_token"] ~ #css-sentry-visible-probe {
  font-family: "CssSentryControlledFont", sans-serif;
}`,
    controlledRequestPath: "/api/hit/font-measurement-container.woff2?session=SESSION_ID",
    endpointKind: "font",
    endpointRequestMeaning: "The endpoint can be reached through the font-measurement endpoint, while measurement-specific meaning comes from CSS Sentry report terms.",
    withoutCssSentry: "A browser may request the font, but this page does not perform a measurement loop.",
    expectedCssSentryFindings: ["sink.font_metric_side_channel", "css.font_measurement_setup", "css.container_size_query"],
    expectedReportText: "Look for font measurement setup, container query, or font metric side-channel terms.",
    fixtureReferences: ["fontleak-container-query-url.css", "fontleak-static-ligature-container.css"],
    cveOrSpecReferences: ["CVE_SPEC Fontleak-style side-channel coverage"],
    extensionCheckInstructions: ["Use this as explanatory coverage after the remote-font signal case.", "Confirm detailed side-channel terms through fixture or report output rather than endpoint state alone."],
    troubleshootingHints: ["Endpoint state is not enough for this class because the risk is the measurement composition, not only the font request."],
    technicalDetails: ["The website deliberately avoids implementing a data-measurement loop."],
    limitations: ["Manual explanation status: fixture tests and source reports are authoritative for full side-channel coverage."],
  }),
] as const;

export type TestCaseId = (typeof TEST_CASES)[number]["id"];
export type LiveTestCaseId = Extract<TestCaseId, string>;

export const TEST_CASE_IDS = TEST_CASES.map((testCase) => testCase.id) as readonly TestCaseId[];
export const TEST_CASE_CATEGORIES = [...new Set(TEST_CASES.map((testCase) => testCase.category))] as readonly TestCaseCategory[];

export function isKnownTestCaseId(value: string): value is TestCaseId {
  return (TEST_CASE_IDS as readonly string[]).includes(value);
}

export function isKnownModeId(value: string): value is ModeId {
  return MODE_DEFINITIONS.some((mode) => mode.id === value);
}

export function testCaseById(id: TestCaseId): TestCaseDefinition {
  return TEST_CASES.find((testCase) => testCase.id === id) ?? TEST_CASES[0];
}
