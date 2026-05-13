import { EMPTY_ANALYSIS_SUMMARY } from "../../shared/constants";
import { systemNow } from "../../shared/clock";
import type { AnalysisState, AnalysisSummary, Finding, Severity } from "../../shared/types";

const SEVERITY_ORDER: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export function mergeSummaries(summaries: AnalysisSummary[], completedAt = systemNow()): AnalysisSummary {
  if (summaries.length === 0) {
    return { ...EMPTY_ANALYSIS_SUMMARY, startedAt: completedAt, finishedAt: completedAt };
  }

  const findings = dedupeFindings(summaries.flatMap((summary) => summary.findings));
  const startedAtValues = summaries.map((summary) => summary.startedAt).filter((value) => value > 0);
  const finishedAtValues = summaries.map((summary) => summary.finishedAt).filter((value) => value > 0);

  return {
    state: aggregateState(summaries),
    findings: findings.sort(compareFindings),
    analyzedStylesheets: summaries.reduce((total, summary) => total + summary.analyzedStylesheets, 0),
    partialStylesheets: summaries.reduce((total, summary) => total + summary.partialStylesheets, 0),
    analyzedFrames: summaries.reduce((total, summary) => total + summary.analyzedFrames, 0),
    partialFrames: summaries.reduce((total, summary) => total + summary.partialFrames, 0),
    startedAt: startedAtValues.length > 0 ? Math.min(...startedAtValues) : completedAt,
    finishedAt: finishedAtValues.length > 0 ? Math.max(...finishedAtValues) : completedAt,
  };
}

function aggregateState(summaries: AnalysisSummary[]): AnalysisState {
  if (summaries.some((summary) => summary.state === "analysis.skipped.performance_budget")) return "analysis.skipped.performance_budget";
  if (summaries.some((summary) => summary.state === "analysis.skipped.too_large")) return "analysis.skipped.too_large";
  if (summaries.some((summary) => summary.state !== "analysis.complete")) return "analysis.partial";
  return "analysis.complete";
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const finding of findings) {
    const key = [finding.pageUrl, finding.frameUrl ?? "", finding.sourceKind, canonicalSourceUrl(finding.sourceUrl), finding.selector ?? "", finding.property ?? "", finding.destinationUrl ?? "", finding.reasons.join(",")].join("|");
    const previous = byKey.get(key);
    if (!previous || SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[previous.severity]) byKey.set(key, finding);
  }
  return [...byKey.values()];
}

function compareFindings(left: Finding, right: Finding): number {
  const severityDelta = SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity];
  if (severityDelta !== 0) return severityDelta;
  const confidenceDelta = right.confidence - left.confidence;
  if (confidenceDelta !== 0) return confidenceDelta;
  return left.timestamp - right.timestamp;
}

function canonicalSourceUrl(sourceUrl: string | null): string {
  if (!sourceUrl) return "";
  try {
    const url = new URL(sourceUrl);
    url.hash = "";
    return url.href;
  } catch {
    return sourceUrl.replace(/#$/, "");
  }
}
