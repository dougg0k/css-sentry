import { REPORT_LIMITS } from "../../shared/constants";
import type { AnalysisSummary, FrameReport, StoredTabReport } from "../../shared/types";
import { mergeSummaries } from "../scanner/summarize";
import { summarizeFrameReports } from "./reportMerging";

const MAX_SAFE_COUNT = 10_000;

export function capStoredReport(report: StoredTabReport): StoredTabReport {
  const frames = (report.frames ?? []).slice(0, REPORT_LIMITS.maxFramesPerReport).map(capFrameReport);
  return {
    ...report,
    frames,
    summary: capSummary(
      frames.length > 0 ? summarizeFrameReports(frames) : report.summary ?? mergeSummaries(frames.map((frame) => frame.summary)),
      REPORT_LIMITS.maxFindingsPerReport,
    ),
  };
}

export function capFrameReport(frame: FrameReport): FrameReport {
  return {
    ...frame,
    summary: capSummary(frame.summary, REPORT_LIMITS.maxFindingsPerFrame),
  };
}

export function capSummary(summary: AnalysisSummary, maxFindings: number): AnalysisSummary {
  return {
    ...summary,
    findings: (summary.findings ?? []).slice(0, maxFindings),
    analyzedStylesheets: clampCount(summary.analyzedStylesheets),
    partialStylesheets: clampCount(summary.partialStylesheets),
    analyzedFrames: clampCount(summary.analyzedFrames),
    partialFrames: clampCount(summary.partialFrames),
  };
}

function clampCount(value: number): number {
  return Math.max(0, Math.min(Number.isFinite(value) ? Math.trunc(value) : 0, MAX_SAFE_COUNT));
}
