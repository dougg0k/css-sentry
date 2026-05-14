import type { AnalysisSummary, ExtensionMode, MitigationAction, ReasonCode, ScanCompleteResponse } from "../../shared/types";

const TEST_LAB_MARKER_SELECTOR = 'meta[name="css-sentry-test-lab"][content="v1"]';
const LOCAL_TEST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SCAN_DIAGNOSTIC_EVENT_NAME = "css-sentry:test-lab-scan";
const REPORT_DIAGNOSTIC_EVENT_NAME = "css-sentry:test-lab-report";

export interface TestLabScanDiagnosticDetail {
  readonly version: 1;
  readonly connected: true;
  readonly state: AnalysisSummary["state"];
  readonly mode: ExtensionMode;
  readonly findingCount: number;
  readonly actionableFindingCount: number;
  readonly reasons: ReasonCode[];
  readonly actions: MitigationAction[];
  readonly partialStylesheets: number;
  readonly partialFrames: number;
}

export interface TestLabReportDiagnosticDetail {
  readonly version: 1;
  readonly connected: true;
  readonly reportSaved: boolean;
  readonly state: AnalysisSummary["state"] | null;
  readonly findingCount: number;
  readonly actionableFindingCount: number;
  readonly reasons: ReasonCode[];
  readonly actions: MitigationAction[];
}

export function publishTestLabDiagnostic(documentRef: Document, summary: AnalysisSummary, mode: ExtensionMode): void {
  publishTestLabScanDiagnostic(documentRef, summary, mode);
}

export function publishTestLabScanDiagnostic(documentRef: Document, summary: AnalysisSummary, mode: ExtensionMode): void {
  if (!isTestLabDiagnosticAllowed(documentRef)) return;
  const detail: TestLabScanDiagnosticDetail = {
    version: 1,
    connected: true,
    state: summary.state,
    mode,
    ...summaryDiagnostic(summary),
    partialStylesheets: summary.partialStylesheets,
    partialFrames: summary.partialFrames,
  };
  dispatchDiagnostic(documentRef, SCAN_DIAGNOSTIC_EVENT_NAME, detail);
}

export function publishTestLabReportDiagnostic(documentRef: Document, response: unknown): void {
  if (!isTestLabDiagnosticAllowed(documentRef)) return;
  const detail = normalizeReportResponse(response);
  dispatchDiagnostic(documentRef, REPORT_DIAGNOSTIC_EVENT_NAME, detail);
}

export function isTestLabDiagnosticAllowed(documentRef: Document): boolean {
  if (!documentRef.querySelector(TEST_LAB_MARKER_SELECTOR)) return false;
  try {
    const url = new URL(documentRef.location.href);
    return (url.protocol === "http:" || url.protocol === "https:") && LOCAL_TEST_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function summaryDiagnostic(summary: AnalysisSummary): Pick<TestLabScanDiagnosticDetail, "findingCount" | "actionableFindingCount" | "reasons" | "actions"> {
  const reasons = new Set<ReasonCode>();
  const actions = new Set<MitigationAction>();
  for (const finding of summary.findings) {
    finding.reasons.forEach((reason) => reasons.add(reason));
    actions.add(finding.action);
    finding.additionalActions?.forEach((action) => actions.add(action));
  }

  return {
    findingCount: summary.findings.length,
    actionableFindingCount: summary.findings.filter((finding) => finding.severity !== "info").length,
    reasons: [...reasons].sort(),
    actions: [...actions].sort(),
  };
}

function normalizeReportResponse(response: unknown): TestLabReportDiagnosticDetail {
  if (isScanCompleteResponse(response)) {
    return {
      version: 1,
      connected: true,
      reportSaved: response.reportSaved,
      state: response.state,
      findingCount: response.findingCount,
      actionableFindingCount: response.actionableFindingCount,
      reasons: [...response.reasons].sort(),
      actions: [...response.actions].sort(),
    };
  }

  return {
    version: 1,
    connected: true,
    reportSaved: false,
    state: null,
    findingCount: 0,
    actionableFindingCount: 0,
    reasons: [],
    actions: [],
  };
}

function isScanCompleteResponse(value: unknown): value is ScanCompleteResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ScanCompleteResponse>;
  return candidate.ok === true
    && typeof candidate.reportSaved === "boolean"
    && typeof candidate.state === "string"
    && typeof candidate.findingCount === "number"
    && typeof candidate.actionableFindingCount === "number"
    && Array.isArray(candidate.reasons)
    && Array.isArray(candidate.actions);
}

function dispatchDiagnostic(documentRef: Document, eventName: string, detail: TestLabScanDiagnosticDetail | TestLabReportDiagnosticDetail): void {
  documentRef.documentElement.dispatchEvent(new CustomEvent<string>(eventName, { detail: JSON.stringify(detail) }));
}
