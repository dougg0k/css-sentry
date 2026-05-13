import type { AnalysisSummary } from "../../shared/types";
import type { Now } from "../../shared/clock";
import { systemNow } from "../../shared/clock";
import { createFinding } from "../../core/findings/createFinding";

export function createPartialStylesheetSummary(pageUrl: string, frameUrl: string, sourceUrl: string | null, now: Now = systemNow): AnalysisSummary {
  const timestamp = now();
  return {
    state: "analysis.partial",
    findings: [
      createFinding({
        severity: "info",
        confidence: 100,
        pageUrl,
        frameUrl,
        sourceKind: "stylesheet",
        sourceUrl,
        state: "stylesheet.cross_origin_uninspectable",
        reasons: ["stylesheet.cross_origin.uninspectable"],
        details: "Stylesheet rules were not inspectable, usually because the browser restricted cross-origin stylesheet access.",
        timestamp,
      }),
    ],
    analyzedStylesheets: 0,
    partialStylesheets: 1,
    analyzedFrames: 0,
    partialFrames: 0,
    startedAt: timestamp,
    finishedAt: timestamp,
  };
}

export function createPartialFrameSummary(pageUrl: string, frameUrl: string, now: Now = systemNow): AnalysisSummary {
  const timestamp = now();
  return {
    state: "analysis.partial",
    findings: [
      createFinding({
        severity: "info",
        confidence: 100,
        pageUrl,
        frameUrl,
        sourceKind: "frame",
        sourceUrl: frameUrl,
        state: "frame.cross_origin_uninspectable",
        reasons: ["frame.cross_origin.uninspectable"],
        details: "Frame content was not inspectable, usually because the browser restricted cross-origin frame access.",
        timestamp,
      }),
    ],
    analyzedStylesheets: 0,
    partialStylesheets: 0,
    analyzedFrames: 0,
    partialFrames: 1,
    startedAt: timestamp,
    finishedAt: timestamp,
  };
}

export function createPerformanceBudgetSummary(pageUrl: string, frameUrl: string, sourceUrl: string | null, details = "Analysis stopped after reaching the configured performance budget.", timestamp = systemNow()): AnalysisSummary {
  return {
    state: "analysis.skipped.performance_budget",
    findings: [
      createFinding({
        severity: "info",
        confidence: 100,
        pageUrl,
        frameUrl,
        sourceKind: "stylesheet",
        sourceUrl,
        state: "analysis.skipped.performance_budget",
        reasons: ["analysis.skipped.performance_budget"],
        details,
        timestamp,
      }),
    ],
    analyzedStylesheets: 0,
    partialStylesheets: 1,
    analyzedFrames: 0,
    partialFrames: 0,
    startedAt: timestamp,
    finishedAt: timestamp,
  };
}
