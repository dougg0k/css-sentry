import { describe, expect, it } from "vitest";
import { EMPTY_ANALYSIS_SUMMARY, REPORT_LIMITS } from "../../../src/shared/constants";
import type { Finding, FrameReport, StoredTabReport } from "../../../src/shared/types";
import { capFrameReport, capStoredReport, capSummary } from "../../../src/browser/storage/reportCapping";

const finding: Finding = {
  id: "finding",
  severity: "medium",
  confidence: 0.8,
  pageUrl: "https://app.example/",
  pageOrigin: "https://app.example",
  frameUrl: "https://app.example/",
  frameOrigin: "https://app.example",
  sourceKind: "style_element",
  sourceUrl: "https://app.example/",
  sourceOrigin: "https://app.example",
  selector: "input[value^=a]",
  property: "background",
  destinationOrigin: "https://attacker.example",
  destinationUrl: "https://attacker.example/a",
  action: "logged",
  state: "analysis.complete",
  reasons: ["selector.attribute.prefix_match", "sink.remote_url"],
  timestamp: 1,
  details: "selector probe with remote sink",
};

function frameReport(frameId: number, findings: Finding[] = [finding]): FrameReport {
  return {
    frameId,
    parentFrameId: frameId === 0 ? -1 : 0,
    frameUrl: `https://app.example/frame-${frameId}`,
    frameOrigin: "https://app.example",
    updatedAt: frameId,
    summary: { ...EMPTY_ANALYSIS_SUMMARY, findings, analyzedFrames: 1 },
  };
}

describe("report capping", () => {
  it("caps summary findings and clamps invalid counters", () => {
    const summary = capSummary({
      ...EMPTY_ANALYSIS_SUMMARY,
      findings: Array.from({ length: 20 }, (_, index) => ({ ...finding, id: `finding-${index}` })),
      analyzedStylesheets: Number.POSITIVE_INFINITY,
      partialStylesheets: -5,
      analyzedFrames: 10_500.9,
      partialFrames: 3.7,
    }, 3);

    expect(summary.findings).toHaveLength(3);
    expect(summary.analyzedStylesheets).toBe(0);
    expect(summary.partialStylesheets).toBe(0);
    expect(summary.analyzedFrames).toBe(10_000);
    expect(summary.partialFrames).toBe(3);
  });

  it("caps a frame report using the per-frame finding limit", () => {
    const capped = capFrameReport(frameReport(0, Array.from({ length: REPORT_LIMITS.maxFindingsPerFrame + 1 }, (_, index) => ({ ...finding, id: `finding-${index}` }))));

    expect(capped.summary.findings).toHaveLength(REPORT_LIMITS.maxFindingsPerFrame);
  });

  it("caps stored reports by frame count, per-frame findings, and aggregate findings", () => {
    const stored: StoredTabReport = {
      tabId: 1,
      url: "https://app.example/",
      origin: "https://app.example",
      updatedAt: 1,
      summary: { ...EMPTY_ANALYSIS_SUMMARY },
      frames: Array.from({ length: REPORT_LIMITS.maxFramesPerReport + 3 }, (_, frameId) => frameReport(frameId, Array.from({ length: REPORT_LIMITS.maxFindingsPerFrame + 1 }, (_, index) => ({ ...finding, id: `f-${frameId}-${index}` })))),
    };

    const capped = capStoredReport(stored);

    expect(capped.frames).toHaveLength(REPORT_LIMITS.maxFramesPerReport);
    expect(capped.frames.every((frame) => frame.summary.findings.length <= REPORT_LIMITS.maxFindingsPerFrame)).toBe(true);
    expect(capped.summary.findings.length).toBeLessThanOrEqual(REPORT_LIMITS.maxFindingsPerReport);
  });
});
