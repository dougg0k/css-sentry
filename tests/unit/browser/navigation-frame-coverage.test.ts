import { describe, expect, it } from "vitest";
import { createCrossOriginSubframePartialReport } from "../../../src/browser/scanner/navigationFrameCoverage";

describe("navigation frame coverage", () => {
  it("creates cross-origin subframe partial reports from browser navigation events", () => {
    const report = createCrossOriginSubframePartialReport({
      tabId: 9,
      topLevelUrl: "https://app.example.test/inbox",
      frameId: 3,
      parentFrameId: 0,
      frameUrl: "https://third-party.example.test/mail",
    });

    expect(report?.frameId).toBe(3);
    expect(report?.parentFrameId).toBe(0);
    expect(report?.frameOrigin).toBe("https://third-party.example.test");
    expect(report?.summary.partialFrames).toBe(1);
    expect(report?.summary.findings[0]?.reasons).toContain("frame.cross_origin.uninspectable");
  });

  it("does not create partial reports for top-level, same-origin, or unsupported frame URLs", () => {
    expect(createCrossOriginSubframePartialReport({
      tabId: 9,
      topLevelUrl: "https://app.example.test/inbox",
      frameId: 0,
      parentFrameId: -1,
      frameUrl: "https://third-party.example.test/mail",
    })).toBeNull();

    expect(createCrossOriginSubframePartialReport({
      tabId: 9,
      topLevelUrl: "https://app.example.test/inbox",
      frameId: 4,
      parentFrameId: 0,
      frameUrl: "https://app.example.test/frame",
    })).toBeNull();

    expect(createCrossOriginSubframePartialReport({
      tabId: 9,
      topLevelUrl: "https://app.example.test/inbox",
      frameId: 5,
      parentFrameId: 0,
      frameUrl: "about:blank",
    })).toBeNull();
  });
});
