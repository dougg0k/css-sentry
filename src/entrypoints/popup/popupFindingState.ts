import { isPartialAnalysisFinding } from "../../shared/findingDisplay";
import type { Finding, MitigationAction } from "../../shared/types";

export const isCoverageFinding = isPartialAnalysisFinding;

export function findingActions(finding: Finding): MitigationAction[] {
  return [...new Set([finding.action, ...(finding.additionalActions ?? [])])];
}

export function changesPage(actionOrFinding: MitigationAction | Finding): boolean {
  const actions = typeof actionOrFinding === "string" ? [actionOrFinding] : findingActions(actionOrFinding);
  return actions.some(isPageChangingAction);
}

export function hasInstalledBlockingRule(actionOrFinding: MitigationAction | Finding): boolean {
  const actions = typeof actionOrFinding === "string" ? [actionOrFinding] : findingActions(actionOrFinding);
  return actions.some(isInstalledBlockingRuleAction);
}

export function pickHighestSeverity(findings: readonly Finding[]): string | null {
  const order = ["info", "low", "medium", "high", "critical"];
  return findings.reduce<string | null>((highest, finding) => highest === null || order.indexOf(finding.severity) > order.indexOf(highest) ? finding.severity : highest, null);
}

export function isPageChangingAction(action: MitigationAction): boolean {
  return action === "blocked_dnr" || action === "blocked_strict_third_party" || action === "neutralized" || action === "disabled_stylesheet" || action === "removed_style_node";
}

export function isInstalledBlockingRuleAction(action: MitigationAction): boolean {
  return action === "rule_installed_dnr" || action === "future_blocked_dnr";
}
