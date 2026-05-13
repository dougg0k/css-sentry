import { FindingItem, Header, InfoTooltip, SummaryCard } from "./components";
import { ADVANCED_MODE_EXPLANATION, LOGS_EXPLANATION, getModeDefinition } from "../../shared/uiMetadata";
import { usePopupState } from "./usePopupState";
import "./style.css";

export default function App() {
  const { report, policy, error, savedMode, view, setGlobalMode, clearReport, openPage } = usePopupState();

  if (error) return <main className="popup"><Header state="analysis.partial" title="CSS Sentry" subtitle={error} hasReport={false} /></main>;

  return (
    <main className="popup">
      <Header
        state={report?.summary.state ?? "analysis.partial"}
        title="CSS Sentry"
        subtitle={view.currentOrigin ?? "No active web origin"}
        hasReport={view.hasReport}
      />

      <section className="statusLine" aria-label="Finding status">
        <div>
          <strong>{view.statusTitle}</strong>
          <span>{view.statusDetail}</span>
        </div>
        {(report?.summary.partialFrames ?? 0) > 0 ? <span>Partial frame coverage: {report?.summary.partialFrames} frame{report?.summary.partialFrames === 1 ? "" : "s"} not fully inspected</span> : null}
      </section>

      <section className="summaryGrid" aria-label="Current page summary">
        <SummaryCard stat="mode" value={view.modeDefinition.shortLabel} />
        <SummaryCard stat="severity" value={view.highestSeverity ?? "none"} />
        <SummaryCard stat="mitigated" value={String(view.mitigatedFindings)} />
        <SummaryCard stat="blocked" value={String(view.pageChangedFindings.length)} />
        <SummaryCard stat="futureRules" value={String(view.ruleInstalledFindings.length)} />
        <SummaryCard stat="allowed" value={String(view.loggedOnlyFindings.length)} />
        <SummaryCard stat="info" value={String(view.infoOnlyFindings.length)} />
        <SummaryCard stat="coverage" value={String(view.coverageFindings.length)} />
        <SummaryCard stat="frames" value={`${report?.summary.analyzedFrames ?? 0}/${(report?.summary.analyzedFrames ?? 0) + (report?.summary.partialFrames ?? 0)}`} />
        <SummaryCard stat="partialSheets" value={String(report?.summary.partialStylesheets ?? 0)} />
      </section>

      <section className="panel">
        <div className="panelTitle"><h2>Protection mode</h2><InfoTooltip text="Change the global protection mode. This is the same default mode shown on the Options page." /></div>
        <p className="muted"><strong>{view.modeDefinition.label}:</strong> {view.modeDefinition.summary}</p>
        <div className="buttonGrid" aria-label="Global protection modes">
          {view.popupModes.map((quickMode) => {
            const definition = getModeDefinition(quickMode);
            return <button
              key={quickMode}
              type="button"
              aria-label={`${definition.label}: ${definition.details}`}
              aria-pressed={view.modeDefinition.mode === quickMode}
              className={view.modeDefinition.mode === quickMode ? "primary" : "secondary"}
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
        {view.visibleFindings.length === 0
          ? <p className="muted">{view.hiddenPartialAnalysisFindings > 0 ? `${view.hiddenPartialAnalysisFindings} partial-analysis finding${view.hiddenPartialAnalysisFindings === 1 ? " is" : "s are"} hidden by the current Options setting.` : "No findings recorded for this tab yet."}</p>
          : <>
            {view.hiddenPartialAnalysisFindings > 0 ? <p className="muted smallText">{view.hiddenPartialAnalysisFindings} partial-analysis finding{view.hiddenPartialAnalysisFindings === 1 ? " is" : "s are"} hidden by the current Options setting. Analysis completeness counters remain visible.</p> : null}
            <ul className="findingList">{view.visibleFindings.slice(0, 8).map((finding) => <FindingItem key={finding.id} finding={finding} />)}</ul>
          </>}
      </section>

      <footer className="footerActions">
        <button className="secondary" onClick={() => void openPage("report")}>Full report</button>
        <button className="secondary" onClick={() => void openPage("options")}>Options</button>
        <button className="danger" onClick={() => void clearReport()}>Clear</button>
      </footer>
    </main>
  );
}
