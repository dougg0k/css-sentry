import type { Finding } from "../../shared/types";
import { findingHasReason, hasAttributeProbeReason, hasDeclarationDataProbeReason, hasFontSideChannelReason } from "../../shared/reasonGroups";

const SEVERITY_PRIORITY = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

export function addCappedFinding(findings: Finding[], candidate: Finding, maxFindings: number): void {
	if (maxFindings <= 0) return;
	if (findings.length < maxFindings) {
		findings.push(candidate);
		return;
	}
	let weakestIndex = 0;
	for (let index = 1; index < findings.length; index += 1) {
		if (compareFindingPriority(findings[index], findings[weakestIndex]) < 0) weakestIndex = index;
	}
	if (compareFindingPriority(candidate, findings[weakestIndex]) > 0) findings[weakestIndex] = candidate;
}

export function compareFindingPriority(left: Finding, right: Finding): number {
	const severityDelta = SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity];
	if (severityDelta !== 0) return severityDelta;
	const confidenceDelta = left.confidence - right.confidence;
	if (confidenceDelta !== 0) return confidenceDelta;
	return reasonPriority(left) - reasonPriority(right);
}

function reasonPriority(finding: Finding): number {
	let score = 0;
	if (findingHasReason(finding, "url.local_network")) score += 3;
	if (hasAttributeProbeReason(finding)) score += 2;
	if (hasDeclarationDataProbeReason(finding)) score += 2;
	if (hasFontSideChannelReason(finding)) score += 2;
	if (findingHasReason(finding, "sink.import_remote")) score += 2;
	if (findingHasReason(finding, "sink.remote_url") || findingHasReason(finding, "sink.svg_paint_remote")) score += 1;
	return score;
}
