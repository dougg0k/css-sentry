export type EndpointState = "not-run" | "pending" | "received" | "not-received";
export type ScanState = "waiting" | "not-connected" | "connected-no-findings" | "findings";
export type ReportState = "waiting" | "not-saved" | "saved";
export type ManualState = "not-checked" | "reported" | "blocked" | "sanitized" | "no-finding" | "unsure";
export type ModeState = "not-sure" | "default" | "passive" | "balanced" | "strict" | "trusted" | "paused" | "always_scan_never_sanitize" | "never_scan_never_sanitize";
export type InterpretationKind = "expected" | "unexpected" | "inconclusive" | "review";

export interface InterpretationInput {
  readonly hasSession: boolean;
  readonly diagnosticOrigin?: "local" | "public";
  readonly endpoint: EndpointState;
  readonly scan: ScanState;
  readonly report: ReportState;
  readonly manual: ManualState;
  readonly mode: ModeState;
}

export interface InterpretationMessage {
  readonly kind: InterpretationKind;
  readonly title: string;
  readonly detail: string;
}

export function interpretTestResult(input: InterpretationInput): InterpretationMessage {
  if (!input.hasSession) {
    return {
      kind: "review",
      title: "Start selected checks",
      detail: "The controlled CSS is rendered only after a test session reloads the page with selected cases.",
    };
  }

  if (input.scan === "not-connected" && input.diagnosticOrigin === "public") {
    return {
      kind: "review",
      title: "Manual report confirmation required",
      detail: "The diagnostic bridge is intentionally local-origin scoped. On public deployments, use CSS Sentry popup/report output with endpoint state instead of expecting automatic scan/report events.",
    };
  }

  if (input.scan === "not-connected") {
    return {
      kind: "unexpected",
      title: "CSS Sentry did not signal on this page",
      detail: "The content script did not publish the Test Lab scan signal. Check extension site access for this origin, Paused or Trusted policy, and whether the installed build includes Test Lab diagnostics.",
    };
  }

  if (input.scan === "connected-no-findings" && input.endpoint === "received") {
    return {
      kind: "unexpected",
      title: "Extension scanned but found no matching issue",
      detail: "The endpoint was reached while CSS Sentry reported zero actionable findings. Treat this as a test-definition or detector-coverage issue for the selected case.",
    };
  }

  if (input.scan === "findings" && input.report === "not-saved") {
    return {
      kind: "unexpected",
      title: "Scanner found issues but the report was not saved",
      detail: "The page scan produced actionable findings, but the background report-save acknowledgement failed or was unavailable. This separates scanner coverage from the report pipeline.",
    };
  }

  if (input.mode === "not-sure") {
    return {
      kind: "review",
      title: "Mode still needs confirmation",
      detail: "Use the detected CSS Sentry mode when available, or open the manual override only when the diagnostic signal is unavailable.",
    };
  }

  if (input.mode === "paused" || input.mode === "trusted" || input.mode === "never_scan_never_sanitize") {
    return {
      kind: "inconclusive",
      title: "Mode intentionally allows reduced protection",
      detail: "Paused, Trusted, and Never scan states can allow endpoint requests and reduce reports. Re-run in Passive, Balanced, or Strict mode before judging detector behavior.",
    };
  }

  if (input.manual === "not-checked") {
    return {
      kind: "review",
      title: "Manual CSS Sentry report check needed",
      detail: "The endpoint result and diagnostic signals are not enough by themselves. Confirm the popup or full report and record what CSS Sentry showed.",
    };
  }

  if (input.manual === "no-finding" && input.endpoint === "received" && (input.mode === "balanced" || input.mode === "strict")) {
    return {
      kind: "unexpected",
      title: "Endpoint reached with no CSS Sentry finding",
      detail: "After site access and policy are confirmed, this points to a detector or Test Lab coverage issue for the selected case.",
    };
  }

  if ((input.manual === "blocked" || input.manual === "sanitized") && input.endpoint === "not-received") {
    return {
      kind: "expected",
      title: "Mitigation result matches the selected check",
      detail: "CSS Sentry reported the case and the controlled endpoint was not reached during the polling window.",
    };
  }

  if ((input.manual === "reported" || input.manual === "blocked" || input.manual === "sanitized") && input.mode === "passive" && input.endpoint === "received") {
    return {
      kind: "expected",
      title: "Expected Passive-mode report-only result",
      detail: "CSS Sentry reported the case while allowing the controlled endpoint request to complete.",
    };
  }

  if (input.manual === "reported" || input.manual === "blocked" || input.manual === "sanitized") {
    return {
      kind: "expected",
      title: "CSS Sentry reported the selected check",
      detail: "Compare the action shown by CSS Sentry with the endpoint state to distinguish report-only behavior from blocking or page-changing mitigation.",
    };
  }

  return {
    kind: "review",
    title: "Review endpoint, scan, report, and mode together",
    detail: "The current states do not support a single verdict. Use the troubleshooting guide and expected finding terms for the selected cases.",
  };
}
