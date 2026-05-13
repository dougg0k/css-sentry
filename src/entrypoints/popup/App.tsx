import { useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { getSitePolicy, getTabReport, saveSitePolicy } from "../../browser/storage/reports";
import type { ExtensionMode, SitePolicy, StoredTabReport } from "../../shared/types";
import { getOrigin, isPolicyOrigin } from "../../shared/url";
import { FindingItem, Header, InfoTooltip, SummaryCard, changesPage, hasInstalledBlockingRule, isCoverageFinding, pickHighestSeverity } from "./components";
import {
  ADVANCED_GLOBAL_MODE_ORDER,
  ADVANCED_MODE_EXPLANATION,
  GLOBAL_MODE_ORDER,
  LOGS_EXPLANATION,
  getModeDefinition,
} from "../../shared/uiMetadata";
import "./style.css";

type ActiveTabState = { id: number; url: string; origin: string | null } | null;

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabState>(null);
  const [report, setReport] = useState<StoredTabReport | null>(null);
  const [policy, setPolicy] = useState<SitePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMode, setSavedMode] = useState<string | null>(null);

  async function refresh() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setError("No active tab found.");
        return;
      }
      const tabUrl = tab.url ?? "";
      const nextActiveTab = { id: tab.id, url: tabUrl, origin: safeOrigin(getOrigin(tabUrl)) };
      setActiveTab(nextActiveTab);
      setReport(await getTabReport(tab.id));
      setPolicy(await getSitePolicy());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load CSS Sentry report.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const findings = report?.summary.findings ?? [];
  const pageChangedFindings = useMemo(() => findings.filter(changesPage), [findings]);
  const ruleInstalledFindings = useMemo(() => findings.filter(hasInstalledBlockingRule), [findings]);
  const coverageFindings = useMemo(() => findings.filter(isCoverageFinding), [findings]);
  const infoOnlyFindings = useMemo(() => findings.filter((finding) => finding.severity === "info" && !isCoverageFinding(finding)), [findings]);
  const actionableFindings = useMemo(() => findings.filter((finding) => finding.severity !== "info"), [findings]);
  const loggedOnlyFindings = useMemo(() => actionableFindings.filter((finding) => !changesPage(finding) && !hasInstalledBlockingRule(finding)), [actionableFindings]);
  const highestSeverity = useMemo(() => pickHighestSeverity(actionableFindings), [actionableFindings]);
  const currentOrigin = safeOrigin(report?.origin) ?? activeTab?.origin ?? null;
  const mode = policy?.mode ?? "balanced";
  const modeDefinition = getModeDefinition(mode);
  const popupModes = policy?.advancedModeEnabled ? ADVANCED_GLOBAL_MODE_ORDER : GLOBAL_MODE_ORDER;
  const hasReport = report !== null;
  const mitigatedFindings = new Set([...pageChangedFindings, ...ruleInstalledFindings].map((finding) => finding.id)).size;
  const statusTitle = pageChangedFindings.length > 0
    ? `${pageChangedFindings.length} request${pageChangedFindings.length === 1 ? "" : "s"} prevented or page change${pageChangedFindings.length === 1 ? "" : "s"} applied`
    : ruleInstalledFindings.length > 0
      ? `${ruleInstalledFindings.length} blocking rule${ruleInstalledFindings.length === 1 ? "" : "s"} active after analysis`
      : "No page changes made";
  const statusDetail = !hasReport
    ? "Waiting for the first page scan"
    : actionableFindings.length === 0
      ? "No risky CSS findings were detected."
      : pageChangedFindings.length === 0
        ? ruleInstalledFindings.length > 0
          ? `${actionableFindings.length} finding${actionableFindings.length === 1 ? "" : "s"} logged; ${ruleInstalledFindings.length} precise rule${ruleInstalledFindings.length === 1 ? "" : "s"} installed for reloads and later matching requests. No request is counted as already prevented unless a rule or policy was active before it fired.`
          : `${actionableFindings.length} finding${actionableFindings.length === 1 ? "" : "s"} logged for review; ${loggedOnlyFindings.length} were not blocked. No request was blocked.`
        : `${actionableFindings.length} finding${actionableFindings.length === 1 ? "" : "s"} logged for review; ${loggedOnlyFindings.length} were logged only; ${ruleInstalledFindings.length} have installed blocking rules.`;

  async function setGlobalMode(nextMode: ExtensionMode) {
    const basePolicy = policy ?? await getSitePolicy();
    const nextPolicy: SitePolicy = { ...basePolicy, mode: nextMode };
    setPolicy(nextPolicy);
    await saveSitePolicy(nextPolicy);
    setSavedMode(getModeDefinition(nextMode).label);
    window.setTimeout(() => setSavedMode(null), 1500);
  }

  async function clearReport() {
    if (!activeTab?.id) return;
    await browser.runtime.sendMessage({ type: "css-sentry:clear-current-report", tabId: activeTab.id });
    await refresh();
  }

  async function openPage(page: "options" | "report") {
    const url = browser.runtime.getURL(page === "options" ? "/options.html" : "/report.html");
    await browser.tabs.create({ url });
  }

  if (error) return <main className="popup"><Header state="analysis.partial" title="CSS Sentry" subtitle={error} hasReport={false} /></main>;

  return (
    <main className="popup">
      <Header
        state={report?.summary.state ?? "analysis.partial"}
        title="CSS Sentry"
        subtitle={currentOrigin ?? "No active web origin"}
        hasReport={hasReport}
      />

      <section className="statusLine" aria-label="Finding status">
        <div>
          <strong>{statusTitle}</strong>
          <span>{statusDetail}</span>
        </div>
        {(report?.summary.partialFrames ?? 0) > 0 ? <span>Partial frame coverage: {report?.summary.partialFrames} frame{report?.summary.partialFrames === 1 ? "" : "s"} not fully inspected</span> : null}
      </section>

      <section className="summaryGrid" aria-label="Current page summary">
        <SummaryCard stat="mode" value={modeDefinition.shortLabel} />
        <SummaryCard stat="severity" value={highestSeverity ?? "none"} />
        <SummaryCard stat="mitigated" value={String(mitigatedFindings)} />
        <SummaryCard stat="blocked" value={String(pageChangedFindings.length)} />
        <SummaryCard stat="futureRules" value={String(ruleInstalledFindings.length)} />
        <SummaryCard stat="allowed" value={String(loggedOnlyFindings.length)} />
        <SummaryCard stat="info" value={String(infoOnlyFindings.length)} />
        <SummaryCard stat="coverage" value={String(coverageFindings.length)} />
        <SummaryCard stat="frames" value={`${report?.summary.analyzedFrames ?? 0}/${(report?.summary.analyzedFrames ?? 0) + (report?.summary.partialFrames ?? 0)}`} />
        <SummaryCard stat="partialSheets" value={String(report?.summary.partialStylesheets ?? 0)} />
      </section>

      <section className="panel">
        <div className="panelTitle"><h2>Protection mode</h2><InfoTooltip text="Change the global protection mode. This is the same default mode shown on the Options page." /></div>
        <p className="muted"><strong>{modeDefinition.label}:</strong> {modeDefinition.summary}</p>
        <div className="buttonGrid" aria-label="Global protection modes">
          {popupModes.map((quickMode) => {
            const definition = getModeDefinition(quickMode);
            return <button
              key={quickMode}
              type="button"
              aria-label={`${definition.label}: ${definition.details}`}
              aria-pressed={mode === quickMode}
              className={mode === quickMode ? "primary" : "secondary"}
              onClick={() => void setGlobalMode(quickMode)}
            >{definition.shortLabel}</button>;
          })}
        </div>
        {savedMode ? <p className="savedInline">Mode saved: {savedMode}</p> : null}
        {policy?.advancedModeEnabled
          ? <p className="muted">Advanced global modes are visible because advanced options are enabled in settings.</p>
          : <p className="muted">Standard modes are shown here. Enable advanced options in settings to reveal scan-only and never-scan global modes. <InfoTooltip text={ADVANCED_MODE_EXPLANATION} /></p>}
      </section>

      <section className="panel">
        <div className="panelTitle"><h2>Findings</h2><InfoTooltip text={LOGS_EXPLANATION} /></div>
        <p className="muted">Each finding shows whether CSS Sentry prevented a request, installed a precise rule after analysis, changed page behavior, only logged it, or recorded a coverage notice. Finding-derived DNR rules apply after analysis; policy rules can prevent matching requests before analysis.</p>
        {findings.length === 0 ? <p className="muted">No findings recorded for this tab yet.</p> : <ul className="findingList">{findings.slice(0, 8).map((finding) => <FindingItem key={finding.id} finding={finding} />)}</ul>}
      </section>

      <footer className="footerActions">
        <button className="secondary" onClick={() => void openPage("report")}>Full report</button>
        <button className="secondary" onClick={() => void openPage("options")}>Options</button>
        <button className="danger" onClick={() => void clearReport()}>Clear</button>
      </footer>
    </main>
  );
}


function safeOrigin(origin: string | null | undefined): string | null {
  return isPolicyOrigin(origin) ? origin : null;
}
