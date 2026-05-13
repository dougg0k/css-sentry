import { useEffect, useState } from "react";
import { clearAllReports, listReports } from "../../browser/storage/reports";
import type { Finding, FrameReport, StoredTabReport } from "../../shared/types";
import { sanitizeStoredReportForExport } from "../../core/privacy/redaction";

export default function ReportApp() {
  const [reports, setReports] = useState<StoredTabReport[]>([]);
  async function refresh() { setReports(await listReports()); }
  useEffect(() => { void refresh(); }, []);
  async function exportReports() {
    const blob = new Blob([JSON.stringify(reports.map(sanitizeStoredReportForExport), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "css-sentry-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <header>
        <p className="eyebrow">CSS Sentry</p>
        <h1>Finding report</h1>
        <p className="muted">Local reports only. Sensitive values are redacted by the analyzer before storage.</p>
        <div className="actions"><button onClick={() => void exportReports()}>Export JSON</button><button onClick={() => void clearAllReports().then(refresh)}>Clear reports</button></div>
      </header>
      {reports.map((report) => <ReportCard key={report.tabId} report={report} />)}
      {reports.length === 0 ? <section className="card"><p>No local reports stored.</p></section> : null}
    </main>
  );
}

function ReportCard({ report }: { report: StoredTabReport }) {
  const totalFrames = report.summary.analyzedFrames + report.summary.partialFrames;
  return (
    <section className="card">
      <h2>{report.origin ?? report.url}</h2>
      <p className="muted">
        {report.summary.state} · {report.summary.findings.length} findings · {report.frames.length} frame reports · {report.summary.analyzedFrames}/{totalFrames} frames analyzed · updated {new Date(report.updatedAt).toLocaleString()}
      </p>
      {report.summary.partialFrames > 0 ? <p className="notice">Partial frame coverage: {report.summary.partialFrames} frame{report.summary.partialFrames === 1 ? "" : "s"} could not be fully inspected.</p> : null}
      {report.frames.map((frame) => <FrameDetails key={frame.frameId} frame={frame} />)}
    </section>
  );
}

function FrameDetails({ frame }: { frame: FrameReport }) {
  const status = frame.summary.state === "analysis.complete" && frame.summary.partialFrames === 0 && frame.summary.partialStylesheets === 0 ? "Complete" : "Partial";
  return (
    <details className="frameDetails" open>
      <summary>Frame {frame.frameId}: {frame.frameOrigin ?? frame.frameUrl} — {status}</summary>
      <dl className="frameMeta">
        <div><dt>Frame URL</dt><dd className="mono">{frame.frameUrl}</dd></div>
        <div><dt>Parent frame</dt><dd>{frame.parentFrameId}</dd></div>
        <div><dt>Status</dt><dd>{frame.summary.state}</dd></div>
        <div><dt>Findings</dt><dd>{frame.summary.findings.length}</dd></div>
        <div><dt>Stylesheets</dt><dd>{frame.summary.analyzedStylesheets} analyzed / {frame.summary.partialStylesheets} partial</dd></div>
        <div><dt>Frames</dt><dd>{frame.summary.analyzedFrames} analyzed / {frame.summary.partialFrames} partial</dd></div>
      </dl>
      {frame.summary.findings.length === 0 ? <p className="muted">No findings recorded for this frame.</p> : <ul>{frame.summary.findings.map((finding) => <FindingRow key={finding.id} finding={finding}/>)}</ul>}
    </details>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return <li className="finding"><strong>{finding.severity}</strong> <span>{finding.details}</span><code>{findingActionText(finding)}</code><code>{finding.reasons.join(" · ")}</code>{finding.frameUrl ? <code>{finding.frameUrl}</code> : null}{finding.destinationOrigin ? <code>{finding.destinationOrigin}</code> : null}</li>;
}

function findingActionText(finding: Finding): string {
  const actions = new Set([finding.action, ...(finding.additionalActions ?? [])]);
  if (actions.has("blocked_dnr")) return "Action: request blocked by an already-active network rule or page mitigation";
  if (actions.has("neutralized") || actions.has("disabled_stylesheet") || actions.has("removed_style_node")) {
    const dnrText = actions.has("rule_installed_dnr") || actions.has("future_blocked_dnr")
      ? "; precise DNR rule installed after analysis; reloads and later matching requests are blocked"
      : "";
    return `Action: ${finding.action}${dnrText}`;
  }
  if (actions.has("rule_installed_dnr") || actions.has("future_blocked_dnr")) return "Action: precise DNR rule installed after analysis; reloads and later matching requests are blocked";
  if (actions.has("blocked_strict_third_party")) return "Action: strict policy blocked this request class";
  if (finding.severity === "info") return "Action: informational only";
  return "Action: logged only; no blocking rule installed for this finding";
}
