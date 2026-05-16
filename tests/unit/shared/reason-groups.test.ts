import { describe, expect, it } from "vitest";
import {
  hasCssFingerprintingReason,
  hasHighConfidenceRenderedTextCssFingerprintingReason,
  hasDeclarationDataProbeReason,
  hasFontSideChannelReason,
  hasFrameCoverageReason,
  hasPartialAnalysisReason,
  hasSensitiveSelectorReason,
  hasSinkReason,
  hasSvgRemoteResourceSinkReason,
} from "../../../src/shared/reasonGroups";
import type { Finding, ReasonCode } from "../../../src/shared/types";

function findingWithReasons(reasons: ReasonCode[]): Finding {
  return {
    id: "finding-test",
    severity: "high",
    confidence: 90,
    pageUrl: "https://app.example/",
    pageOrigin: "https://app.example",
    frameUrl: "https://app.example/",
    frameOrigin: "https://app.example",
    sourceKind: "style_element",
    sourceUrl: "https://app.example/",
    sourceOrigin: "https://app.example",
    selector: null,
    property: null,
    destinationOrigin: null,
    destinationUrl: null,
    action: "logged",
    state: "analysis.complete",
    reasons,
    timestamp: 1,
    details: "test",
  };
}

describe("reason groups", () => {
  it("classifies sink, selector, declaration, font, SVG, frame, and partial-analysis groups", () => {
    const finding = findingWithReasons([
      "sink.remote_url",
      "selector.attribute.substring_match",
      "css.value.attr_source",
      "sink.font_metric_side_channel",
      "sink.svg_feimage_remote",
      "frame.cross_origin.uninspectable",
      "analysis.skipped.performance_budget",
    ]);

    expect(hasSinkReason(finding)).toBe(true);
    expect(hasSensitiveSelectorReason(finding)).toBe(true);
    expect(hasDeclarationDataProbeReason(finding)).toBe(true);
    expect(hasFontSideChannelReason(finding)).toBe(true);
    expect(hasSvgRemoteResourceSinkReason(finding)).toBe(true);
    expect(hasFrameCoverageReason(finding)).toBe(true);
    expect(hasPartialAnalysisReason(finding)).toBe(true);
    expect(hasCssFingerprintingReason(finding)).toBe(false);
  });

  it("classifies experimental CSS fingerprinting reasons separately", () => {
    const finding = findingWithReasons(["privacy.css_fingerprinting.rendered_text_signal", "privacy.css_fingerprinting.print_signal"]);
    expect(hasCssFingerprintingReason(finding)).toBe(true);
    expect(hasHighConfidenceRenderedTextCssFingerprintingReason(finding)).toBe(true);
    expect(hasPartialAnalysisReason(finding)).toBe(false);
  });
});
