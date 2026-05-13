import type { ExtensionMode, Finding } from "../../shared/types";
import { findingHasReason, hasDeclarationDataProbeReason, hasFontSideChannelReason, hasSensitiveSelectorReason, hasSinkReason, hasSvgRemoteResourceSinkReason } from "../../shared/reasonGroups";

const DNR_SEVERITY_PRIORITY = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

export function compareDnrCandidatePriority(left: Finding, right: Finding): number {
  const severityDelta = DNR_SEVERITY_PRIORITY[right.severity] - DNR_SEVERITY_PRIORITY[left.severity];
  if (severityDelta !== 0) return severityDelta;
  const localNetworkDelta = Number(findingHasReason(right, "url.local_network")) - Number(findingHasReason(left, "url.local_network"));
  if (localNetworkDelta !== 0) return localNetworkDelta;
  const importDelta = Number(findingHasReason(right, "sink.import_remote")) - Number(findingHasReason(left, "sink.import_remote"));
  if (importDelta !== 0) return importDelta;
  const selectorDelta = Number(hasSensitiveSelectorReason(right)) - Number(hasSensitiveSelectorReason(left));
  if (selectorDelta !== 0) return selectorDelta;
  const declarationProbeDelta = Number(hasDeclarationDataProbeReason(right)) - Number(hasDeclarationDataProbeReason(left));
  if (declarationProbeDelta !== 0) return declarationProbeDelta;
  const fontSideChannelDelta = Number(hasFontSideChannelReason(right)) - Number(hasFontSideChannelReason(left));
  if (fontSideChannelDelta !== 0) return fontSideChannelDelta;
  return right.confidence - left.confidence;
}

export function isSeverityEligibleForDnr(finding: Finding, mode: ExtensionMode): boolean {
  if (mode === "strict") return finding.severity === "medium" || finding.severity === "high" || finding.severity === "critical";
  return finding.severity === "high" || finding.severity === "critical";
}

export function findingDnrRequestUrl(finding: Finding): string | null {
  const value = finding.requestUrl ?? finding.destinationUrl;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isFindingDnrRuleCandidate(finding: Finding, mode: ExtensionMode = "balanced"): boolean {
  return findingDnrRequestUrl(finding) !== null && isSeverityEligibleForDnr(finding, mode) && isFindingDnrBlockCandidate(finding, mode);
}

export function isFindingDnrBlockCandidate(finding: Finding, mode: ExtensionMode): boolean {
  if (mode === "strict") return isStrictDnrBlockCandidate(finding);
  return isBalancedDnrBlockCandidate(finding);
}

function isStrictDnrBlockCandidate(finding: Finding): boolean {
  if (!hasSinkReason(finding) && !findingHasReason(finding, "url.local_network")) return false;
  if (findingHasReason(finding, "sink.font_remote") && !hasSensitiveSelectorReason(finding)) return false;
  if (hasSensitiveSelectorReason(finding)) return true;
  if (hasDeclarationDataProbeReason(finding)) return true;
  if (hasFontSideChannelReason(finding)) return true;
  if (hasSvgRemoteResourceSinkReason(finding)) return true;
  if (findingHasReason(finding, "sink.import_remote")) return true;
  if (findingHasReason(finding, "url.local_network")) return true;
  return findingHasReason(finding, "sink.image_set_remote");
}

function isBalancedDnrBlockCandidate(finding: Finding): boolean {
  if (findingHasReason(finding, "sink.font_remote") && !hasSensitiveSelectorReason(finding)) return false;
  if (!hasSinkReason(finding) && !findingHasReason(finding, "url.local_network")) return false;
  if (findingHasReason(finding, "url.local_network")) return true;
  if (hasSensitiveSelectorReason(finding)) return true;
  if (hasDeclarationDataProbeReason(finding)) return true;
  if (hasFontSideChannelReason(finding) && findingHasReason(finding, "url.cross_origin")) return true;
  if (findingHasReason(finding, "sink.import_remote") && findingHasReason(finding, "url.cross_origin")) return true;
  if (hasSvgRemoteResourceSinkReason(finding) && findingHasReason(finding, "url.cross_origin")) return true;
  return false;
}

