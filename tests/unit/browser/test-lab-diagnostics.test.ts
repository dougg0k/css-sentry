import { describe, expect, it, vi } from "vitest";
import { isTestLabDiagnosticAllowed, publishTestLabReportDiagnostic, publishTestLabScanDiagnostic } from "../../../src/browser/scanner/testLabDiagnostics";
import type { AnalysisSummary } from "../../../src/shared/types";

function summary(): AnalysisSummary {
  return {
    state: "analysis.complete",
    findings: [{
      id: "finding-1",
      severity: "high",
      confidence: 90,
      pageUrl: "http://localhost:4321/tests/",
      pageOrigin: "http://localhost:4321",
      frameUrl: "http://localhost:4321/tests/",
      frameOrigin: "http://localhost:4321",
      sourceKind: "style_element",
      sourceUrl: "http://localhost:4321/tests/",
      sourceOrigin: "http://localhost:4321",
      selector: "input[value*=secret] ~ #probe",
      property: "background-image",
      destinationOrigin: "http://localhost:4321",
      destinationUrl: "http://localhost:4321/api/hit/known-detector-smoke.svg",
      action: "logged",
      state: "analysis.complete",
      reasons: ["selector.attribute.substring_match", "sink.remote_url"],
      timestamp: 1,
      details: "test finding",
    }],
    analyzedStylesheets: 1,
    partialStylesheets: 0,
    analyzedFrames: 1,
    partialFrames: 0,
    startedAt: 0,
    finishedAt: 1,
  };
}

describe("test lab diagnostics", () => {
  it("only allows marked local Test Lab pages", () => {
    document.head.innerHTML = '<meta name="css-sentry-test-lab" content="v1">';
    expect(isTestLabDiagnosticAllowed(document)).toBe(true);

    document.head.innerHTML = "";
    expect(isTestLabDiagnosticAllowed(document)).toBe(false);
  });

  it("publishes a scan diagnostic event without selectors or URLs", () => {
    document.head.innerHTML = '<meta name="css-sentry-test-lab" content="v1">';
    const listener = vi.fn();
    document.documentElement.addEventListener("css-sentry:test-lab-scan", listener);

    publishTestLabScanDiagnostic(document, summary(), "balanced");

    expect(listener).toHaveBeenCalledTimes(1);
    const rawDetail = listener.mock.calls[0][0].detail;
    expect(typeof rawDetail).toBe("string");
    const detail = JSON.parse(rawDetail);
    expect(detail.connected).toBe(true);
    expect(detail.mode).toBe("balanced");
    expect(detail.actionableFindingCount).toBe(1);
    expect(detail.reasons).toContain("selector.attribute.substring_match");
    expect(rawDetail).not.toContain("input[value");
    expect(rawDetail).not.toContain("api/hit");
  });

  it("publishes a separate report-save diagnostic acknowledgement", () => {
    document.head.innerHTML = '<meta name="css-sentry-test-lab" content="v1">';
    const listener = vi.fn();
    document.documentElement.addEventListener("css-sentry:test-lab-report", listener);

    publishTestLabReportDiagnostic(document, {
      ok: true,
      reportSaved: true,
      state: "analysis.complete",
      findingCount: 1,
      actionableFindingCount: 1,
      reasons: ["sink.remote_url"],
      actions: ["logged"],
    });

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = JSON.parse(listener.mock.calls[0][0].detail);
    expect(detail.connected).toBe(true);
    expect(detail.reportSaved).toBe(true);
    expect(detail.actionableFindingCount).toBe(1);
  });
});
