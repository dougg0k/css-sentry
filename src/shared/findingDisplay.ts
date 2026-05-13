import { DEFAULT_SITE_POLICY } from "./constants";
import type { Finding, SitePolicy } from "./types";
import { hasPartialAnalysisReason } from "./reasonGroups";

export function isPartialAnalysisFinding(finding: Finding): boolean {
  return hasPartialAnalysisReason(finding);
}

export function shouldShowPartialAnalysisFindings(policy: SitePolicy | null | undefined): boolean {
  return policy?.compatibility.showPartialAnalysisFindings ?? DEFAULT_SITE_POLICY.compatibility.showPartialAnalysisFindings;
}

export function filterFindingsForDisplay(findings: readonly Finding[], policy: SitePolicy | null | undefined): Finding[] {
  if (shouldShowPartialAnalysisFindings(policy)) return [...findings];
  return findings.filter((finding) => !isPartialAnalysisFinding(finding));
}

export function countHiddenPartialAnalysisFindings(findings: readonly Finding[], policy: SitePolicy | null | undefined): number {
  if (shouldShowPartialAnalysisFindings(policy)) return 0;
  return findings.filter(isPartialAnalysisFinding).length;
}
