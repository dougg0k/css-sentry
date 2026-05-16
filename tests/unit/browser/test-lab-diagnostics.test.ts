import { describe, expect, it, vi } from "vitest";
import {
  isTestLabDiagnosticAllowed,
  publishTestLabReportDiagnostic,
  publishTestLabScanDiagnostic,
  publishTestLabScanDisabledDiagnostic,
} from "../../../src/browser/scanner/testLabDiagnostics";
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
  it("allows marked local and Cloudflare Worker Test Lab pages only", () => {
    document.head.innerHTML = '<meta name="css-sentry-test-lab" content="v1">';
    expect(isTestLabDiagnosticAllowed(document)).toBe(true);
    expect(isTestLabDiagnosticAllowed(testLabDocument("https://css-sentry-test-lab.example.workers.dev/tests/"))).toBe(true);
    expect(isTestLabDiagnosticAllowed(testLabDocument("https://example.com/tests/"))).toBe(false);

    document.head.innerHTML = "";
    expect(isTestLabDiagnosticAllowed(document)).toBe(false);
  });

  it("publishes a scan diagnostic event without selectors or URLs", () => {
    document.head.innerHTML = '<meta name="css-sentry-test-lab" content="v1">';
    const listener = vi.fn();
    document.documentElement.addEventListener("css-sentry:test-lab-scan", listener);

    document.documentElement.setAttribute("data-css-sentry-test-lab-session", "00000000-0000-4000-8000-000000000000");

    publishTestLabScanDiagnostic(document, summary(), "balanced");

    expect(listener).toHaveBeenCalledTimes(1);
    const rawDetail = listener.mock.calls[0][0].detail;
    expect(typeof rawDetail).toBe("string");
    const detail = JSON.parse(rawDetail);
    expect(detail.connected).toBe(true);
    expect(detail.mode).toBe("balanced");
    expect(detail.actionableFindingCount).toBe(1);
    expect(detail.testSessionId).toBe("00000000-0000-4000-8000-000000000000");
    expect(detail.reasons).toContain("selector.attribute.substring_match");
    expect(rawDetail).not.toContain("input[value");
    expect(rawDetail).not.toContain("api/hit");

    const storedDetail = document.documentElement.getAttribute("data-css-sentry-test-lab-scan");
    expect(storedDetail).toBe(rawDetail);
  });

  it("also publishes the sanitized scan diagnostic through the page message channel", () => {
    document.head.innerHTML = '<meta name="css-sentry-test-lab" content="v1">';
    document.documentElement.removeAttribute("data-css-sentry-test-lab-session");
    const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

    publishTestLabScanDiagnostic(document, summary(), "balanced");

    expect(postMessage).toHaveBeenCalledWith(
      {
        source: "css-sentry-test-lab",
        eventName: "css-sentry:test-lab-scan",
        detail: document.documentElement.getAttribute("data-css-sentry-test-lab-scan"),
      },
      document.location.origin,
    );
    expect(postMessage.mock.calls[0][0].detail).not.toContain("api/hit");
    postMessage.mockRestore();
  });

  it("publishes a scan-disabled diagnostic when policy mode prevents scanning", () => {
    document.head.innerHTML = '<meta name="css-sentry-test-lab" content="v1">';
    const listener = vi.fn();
    document.documentElement.addEventListener("css-sentry:test-lab-scan", listener);

    publishTestLabScanDisabledDiagnostic(document, "trusted");

    expect(listener).toHaveBeenCalledTimes(1);
    const rawDetail = listener.mock.calls[0][0].detail;
    const detail = JSON.parse(rawDetail);
    expect(detail.connected).toBe(true);
    expect(detail.mode).toBe("trusted");
    expect(detail.actionableFindingCount).toBe(0);
    expect(detail.scanSkipped).toBe(true);
    expect(detail.scanSkippedReason).toBe("mode.scan_disabled");
    expect(document.documentElement.getAttribute("data-css-sentry-test-lab-scan")).toBe(rawDetail);
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
    expect(document.documentElement.getAttribute("data-css-sentry-test-lab-report")).toBe(listener.mock.calls[0][0].detail);
  });
});

function testLabDocument(href: string): Document {
  return {
    querySelector: (selector: string) => selector === 'meta[name="css-sentry-test-lab"][content="v1"]' ? {} : null,
    location: { href },
    documentElement: document.documentElement,
    defaultView: window,
  } as unknown as Document;
}
