import { countHiddenPartialAnalysisFindings, filterFindingsForDisplay } from "../../shared/findingDisplay";
import { getOrigin, isPolicyOrigin } from "../../shared/url";
import type { Finding, SitePolicy, StoredTabReport } from "../../shared/types";
import { changesPage, hasInstalledBlockingRule, isCoverageFinding, pickHighestSeverity } from "./popupFindingState";
import { ADVANCED_GLOBAL_MODE_ORDER, GLOBAL_MODE_ORDER, getModeDefinition } from "../../shared/uiMetadata";

type ActiveTabState = { id: number; url: string; origin: string | null } | null;

export interface PopupViewState {
  findings: Finding[];
  visibleFindings: Finding[];
  hiddenPartialAnalysisFindings: number;
  pageChangedFindings: Finding[];
  ruleInstalledFindings: Finding[];
  coverageFindings: Finding[];
  infoOnlyFindings: Finding[];
  actionableFindings: Finding[];
  loggedOnlyFindings: Finding[];
  highestSeverity: string | null;
  currentOrigin: string | null;
  modeDefinition: ReturnType<typeof getModeDefinition>;
  popupModes: typeof GLOBAL_MODE_ORDER | typeof ADVANCED_GLOBAL_MODE_ORDER;
  hasReport: boolean;
  mitigatedFindings: number;
  statusTitle: string;
  statusDetail: string;
}

export function activeTabState(tab: { id?: number; url?: string | null } | undefined): ActiveTabState {
  if (!tab?.id) return null;
  const tabUrl = tab.url ?? "";
  return { id: tab.id, url: tabUrl, origin: safeOrigin(getOrigin(tabUrl)) };
}

export function derivePopupViewState(report: StoredTabReport | null, policy: SitePolicy | null, activeTab: ActiveTabState): PopupViewState {
  const findings = report?.summary.findings ?? [];
  const visibleFindings = filterFindingsForDisplay(findings, policy);
  const hiddenPartialAnalysisFindings = countHiddenPartialAnalysisFindings(findings, policy);
  const pageChangedFindings = visibleFindings.filter(changesPage);
  const ruleInstalledFindings = visibleFindings.filter(hasInstalledBlockingRule);
  const coverageFindings = visibleFindings.filter(isCoverageFinding);
  const infoOnlyFindings = visibleFindings.filter((finding) => finding.severity === "info" && !isCoverageFinding(finding));
  const actionableFindings = visibleFindings.filter((finding) => finding.severity !== "info");
  const loggedOnlyFindings = actionableFindings.filter((finding) => !changesPage(finding) && !hasInstalledBlockingRule(finding));
  const mode = policy?.mode ?? "balanced";

  return {
    findings,
    visibleFindings,
    hiddenPartialAnalysisFindings,
    pageChangedFindings,
    ruleInstalledFindings,
    coverageFindings,
    infoOnlyFindings,
    actionableFindings,
    loggedOnlyFindings,
    highestSeverity: pickHighestSeverity(actionableFindings),
    currentOrigin: safeOrigin(report?.origin) ?? activeTab?.origin ?? null,
    modeDefinition: getModeDefinition(mode),
    popupModes: policy?.advancedModeEnabled ? ADVANCED_GLOBAL_MODE_ORDER : GLOBAL_MODE_ORDER,
    hasReport: report !== null,
    mitigatedFindings: countUniqueMitigatedFindings(pageChangedFindings, ruleInstalledFindings),
    statusTitle: popupStatusTitle(pageChangedFindings, ruleInstalledFindings),
    statusDetail: popupStatusDetail(report !== null, actionableFindings, pageChangedFindings, ruleInstalledFindings, loggedOnlyFindings),
  };
}

function popupStatusTitle(pageChangedFindings: readonly Finding[], ruleInstalledFindings: readonly Finding[]): string {
  if (pageChangedFindings.length > 0) return `${pageChangedFindings.length} request${pageChangedFindings.length === 1 ? "" : "s"} prevented or page change${pageChangedFindings.length === 1 ? "" : "s"} applied`;
  if (ruleInstalledFindings.length > 0) return `${ruleInstalledFindings.length} blocking rule${ruleInstalledFindings.length === 1 ? "" : "s"} active after analysis`;
  return "No page changes made";
}

function popupStatusDetail(
  hasReport: boolean,
  actionableFindings: readonly Finding[],
  pageChangedFindings: readonly Finding[],
  ruleInstalledFindings: readonly Finding[],
  loggedOnlyFindings: readonly Finding[],
): string {
  if (!hasReport) return "Waiting for the first page scan";
  if (actionableFindings.length === 0) return "No risky CSS findings were detected.";
  if (pageChangedFindings.length > 0) return `${actionableFindings.length} finding${actionableFindings.length === 1 ? "" : "s"} logged for review; ${loggedOnlyFindings.length} were logged only; ${ruleInstalledFindings.length} have installed blocking rules.`;
  if (ruleInstalledFindings.length > 0) return `${actionableFindings.length} finding${actionableFindings.length === 1 ? "" : "s"} logged; ${ruleInstalledFindings.length} precise rule${ruleInstalledFindings.length === 1 ? "" : "s"} installed for reloads and later matching requests. No request is counted as already prevented unless a rule or policy was active before it fired.`;
  return `${actionableFindings.length} finding${actionableFindings.length === 1 ? "" : "s"} logged for review; ${loggedOnlyFindings.length} were not blocked. No request was blocked.`;
}

function countUniqueMitigatedFindings(pageChangedFindings: readonly Finding[], ruleInstalledFindings: readonly Finding[]): number {
  return new Set([...pageChangedFindings, ...ruleInstalledFindings].map((finding) => finding.id)).size;
}

function safeOrigin(origin: string | null | undefined): string | null {
  return isPolicyOrigin(origin) ? origin : null;
}
