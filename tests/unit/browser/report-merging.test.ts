import { describe, expect, it } from "vitest";
import { EMPTY_ANALYSIS_SUMMARY } from "../../../src/shared/constants";
import type { Finding, FrameReport } from "../../../src/shared/types";
import { countDistinctPartialFrames, summarizeFrameReports, upsertFrame } from "../../../src/browser/storage/reportMerging";

const baseFinding: Finding = {
  id: "finding-1",
  severity: "info",
  confidence: 0.5,
  pageUrl: "https://app.example/",
  pageOrigin: "https://app.example",
  frameUrl: "https://third.example/frame",
  frameOrigin: "https://third.example",
  sourceKind: "frame",
  sourceUrl: "https://third.example/frame",
  sourceOrigin: "https://third.example",
  selector: null,
  property: null,
  destinationOrigin: null,
  destinationUrl: null,
  action: "logged",
  state: "frame.cross_origin_uninspectable",
  reasons: ["frame.cross_origin.uninspectable"],
  timestamp: 1,
  details: "Cross-origin frame could not be inspected.",
};

function frameReport(frameId: number, partialFrames: number, findings: Finding[] = []): FrameReport {
  return {
    frameId,
    parentFrameId: frameId === 0 ? -1 : 0,
    frameUrl: frameId === 0 ? "https://app.example/" : `https://third.example/frame-${frameId}`,
    frameOrigin: frameId === 0 ? "https://app.example" : "https://third.example",
    updatedAt: frameId,
    summary: {
      ...EMPTY_ANALYSIS_SUMMARY,
      state: partialFrames > 0 ? "analysis.partial" : "analysis.complete",
      findings,
      analyzedFrames: 1,
      partialFrames,
    },
  };
}

describe("report frame merging", () => {
  it("upserts frames by frame id and preserves deterministic frame order", () => {
    const frames = [frameReport(2, 0), frameReport(1, 0)];
    const upserted = upsertFrame(frames, { ...frameReport(2, 1), frameUrl: "https://updated.example/frame" });

    expect(upserted.map((frame) => frame.frameId)).toEqual([1, 2]);
    expect(upserted.find((frame) => frame.frameId === 2)?.frameUrl).toBe("https://updated.example/frame");
    expect(frames.find((frame) => frame.frameId === 2)?.frameUrl).toBe("https://third.example/frame-2");
  });

  it("deduplicates partial-frame findings that describe the same frame", () => {
    const findingFromParent = { ...baseFinding, id: "parent-scan", frameUrl: "https://third.example/shared" };
    const findingFromNavigation = { ...baseFinding, id: "navigation", frameUrl: "https://third.example/shared" };

    expect(countDistinctPartialFrames([
      frameReport(0, 1, [findingFromParent]),
      frameReport(2, 1, [findingFromNavigation]),
    ], 2)).toBe(1);
  });

  it("uses unattributed frame URLs when partial coverage has no finding key", () => {
    expect(countDistinctPartialFrames([
      frameReport(1, 1),
      frameReport(2, 1),
    ], 0)).toBe(2);
  });

  it("preserves fallback partial-frame count when no frame-specific evidence exists", () => {
    expect(countDistinctPartialFrames([frameReport(0, 0)], 4)).toBe(4);
  });

  it("summarizes merged frame reports with deduplicated partial-frame coverage", () => {
    const sharedFrameFinding = { ...baseFinding, frameUrl: "https://third.example/shared" };
    const summary = summarizeFrameReports([
      frameReport(0, 1, [sharedFrameFinding]),
      frameReport(2, 1, [{ ...sharedFrameFinding, id: "same-frame" }]),
    ]);

    expect(summary.analyzedFrames).toBe(2);
    expect(summary.partialFrames).toBe(1);
    expect(summary.state).toBe("analysis.partial");
  });
});
