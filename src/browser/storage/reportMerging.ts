import type { AnalysisSummary, Finding, FrameReport } from "../../shared/types";
import { hasFrameCoverageReason } from "../../shared/reasonGroups";
import { mergeSummaries } from "../scanner/summarize";

export function summarizeFrameReports(frames: readonly FrameReport[]): AnalysisSummary {
  const mergedSummary = mergeSummaries(frames.map((item) => item.summary));
  const partialFrameCount = countDistinctPartialFrames(frames, mergedSummary.partialFrames);
  return { ...mergedSummary, partialFrames: partialFrameCount };
}

export function countDistinctPartialFrames(frames: readonly FrameReport[], fallbackCount: number): number {
  const partialFrameKeys = new Set<string>();

  for (const frame of frames) {
    const frameFindingKeys = frame.summary.findings
      .map(partialFrameFindingKey)
      .filter((frameKey): frameKey is string => frameKey !== null);

    for (const frameKey of frameFindingKeys) partialFrameKeys.add(frameKey);

    const hasPartialStylesheetCoverage = frame.summary.partialStylesheets > 0;
    const hasUnattributedPartialFrameCoverage = frame.summary.partialFrames > 0 && frameFindingKeys.length === 0 && frame.summary.state !== "analysis.complete";

    if (hasPartialStylesheetCoverage || hasUnattributedPartialFrameCoverage) {
      partialFrameKeys.add(frame.frameUrl || `frame:${frame.frameId}`);
    }
  }

  return partialFrameKeys.size > 0 ? partialFrameKeys.size : fallbackCount;
}

export function partialFrameFindingKey(finding: Finding): string | null {
  if (!hasFrameCoverageReason(finding)) return null;
  return finding.frameUrl || finding.sourceUrl || null;
}

export function upsertFrame(frames: readonly FrameReport[], frame: FrameReport): FrameReport[] {
  const next = frames.filter((item) => item.frameId !== frame.frameId);
  next.push(frame);
  return next.sort((a, b) => a.frameId - b.frameId);
}
