import type { Finding, MitigationAction } from "../../shared/types";
import { SUMMARY_STAT_DEFINITIONS } from "../../shared/uiMetadata";
import { InfoTooltip } from "../../shared/components/InfoTooltip";

export function Header({ state, title, subtitle, hasReport }: { state: string; title: string; subtitle: string; hasReport: boolean }) {
  const statusLabel = !hasReport ? "Waiting" : state === "analysis.complete" ? "Complete" : "Partial";
  return <header className="hero"><div><p className="eyebrow">CSS Sentry</p><h1>{title}</h1><p className="mono" title={subtitle}>{subtitle}</p></div><span className={statusLabel === "Complete" ? "status statusGood" : "status statusPartial"}>{statusLabel}</span></header>;
}

export function SummaryCard({ stat, value }: { stat: keyof typeof SUMMARY_STAT_DEFINITIONS; value: string }) {
  const definition = SUMMARY_STAT_DEFINITIONS[stat];
  return <div className="summaryCard"><span>{definition.label} <InfoTooltip text={definition.tooltip} /></span><strong>{value}</strong></div>;
}

export function FindingItem({ finding }: { finding: Finding }) {
  const action = actionDisplay(finding);
  return <li className="findingItem">
    <div className="findingHeader"><strong>{finding.severity}</strong><span>{finding.confidence}%</span></div>
    <div className="findingActionRow"><span className={`actionBadge ${action.className}`}>{action.label}</span><span>{action.description}</span></div>
    <p>{finding.details}</p>
    {finding.destinationOrigin ? <p className="mono">{finding.destinationOrigin}</p> : null}
    <p className="reasonList">{finding.reasons.slice(0, 5).join(" · ")}</p>
  </li>;
}

export function pickHighestSeverity(findings: Finding[]): string | null {
  const order = ["info", "low", "medium", "high", "critical"];
  return findings.reduce<string | null>((highest, finding) => highest === null || order.indexOf(finding.severity) > order.indexOf(highest) ? finding.severity : highest, null);
}

export function isCoverageFinding(finding: Finding): boolean {
  return finding.reasons.some((reason) => reason.startsWith("stylesheet.") || reason.startsWith("frame.") || reason.startsWith("resource.svg_image_document") || reason.startsWith("analysis.skipped"));
}

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

function isPageChangingAction(action: MitigationAction): boolean {
  return action === "blocked_dnr" || action === "blocked_strict_third_party" || action === "neutralized" || action === "disabled_stylesheet" || action === "removed_style_node";
}

function isInstalledBlockingRuleAction(action: MitigationAction): boolean {
  return action === "rule_installed_dnr" || action === "future_blocked_dnr";
}

function actionDisplay(finding: Finding): { label: string; description: string; className: string } {
  const actions = findingActions(finding);
  if (actions.includes("blocked_dnr")) {
    return { label: "Blocked", description: "A pre-existing network rule or policy prevented matching requests for this finding.", className: "actionBlocked" };
  }
  if (actions.includes("neutralized") || actions.includes("disabled_stylesheet") || actions.includes("removed_style_node")) {
    const dnrText = actions.some(isInstalledBlockingRuleAction) ? " A precise DNR rule was also installed for reloads and later matching requests." : "";
    return { label: "Changed on page", description: `CSS Sentry changed page behavior for this finding.${dnrText}`, className: "actionBlocked" };
  }
  if (actions.some(isInstalledBlockingRuleAction)) {
    return { label: "Rule installed", description: "A precise DNR rule was installed after analysis. Reloads and later matching requests are blocked, but this row is not counted as a request already prevented.", className: "actionBlocked" };
  }
  if (actions.includes("blocked_strict_third_party")) {
    return { label: "Strict policy blocked", description: "A strict network policy blocked this request class before page CSS analysis was needed.", className: "actionBlocked" };
  }
  if (isCoverageFinding(finding)) {
    return { label: "Coverage notice", description: "Informational coverage gap; no page change was made.", className: "actionCoverage" };
  }
  if (finding.severity === "info") {
    return { label: "Info only", description: "Recorded for visibility; no page change was made.", className: "actionInfo" };
  }
  return { label: "Logged only", description: "Potential issue recorded; no blocking rule was installed for this finding.", className: "actionAllowed" };
}

export { InfoTooltip };
