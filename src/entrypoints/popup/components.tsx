import type { Finding } from "../../shared/types";
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
  return <li className="findingItem"><div className="findingHeader"><strong>{finding.severity}</strong><span>{finding.confidence}%</span></div><p>{finding.details}</p>{finding.destinationOrigin ? <p className="mono">{finding.destinationOrigin}</p> : null}<p className="reasonList">{finding.reasons.slice(0, 5).join(" · ")}</p></li>;
}

export function pickHighestSeverity(findings: Finding[]): string | null {
  const order = ["info", "low", "medium", "high", "critical"];
  return findings.reduce<string | null>((highest, finding) => highest === null || order.indexOf(finding.severity) > order.indexOf(highest) ? finding.severity : highest, null);
}

export { InfoTooltip };
