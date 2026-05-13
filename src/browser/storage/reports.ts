import { browser } from "wxt/browser";
import { EMPTY_ANALYSIS_SUMMARY, REPORT_LIMITS, STORAGE_KEYS } from "../../shared/constants";
import type { Now } from "../../shared/clock";
import { systemNow } from "../../shared/clock";
import type { AnalysisSummary, FrameReport, SitePolicy, StoredTabReport } from "../../shared/types";
import { getOrigin } from "../../shared/url";
import { redactSensitiveUrl, sanitizeFrameReportForStorage, sanitizeStoredReportForExport } from "../../core/privacy/redaction";
import { capFrameReport, capStoredReport, capSummary } from "./reportCapping";
import { summarizeFrameReports, upsertFrame } from "./reportMerging";
import { enforceReportRetention } from "./reportRetention";
import { getSitePolicy, persistSitePolicy } from "./policyStore";
export { normalizePolicy } from "./policyNormalization";
export { parseImportedSitePolicy } from "./settingsImport";
export { getSitePolicy } from "./policyStore";

export async function saveFrameReport(tabId: number, topLevelUrl: string, frame: FrameReport, now: Now = systemNow): Promise<StoredTabReport> {
  const current = await getTabReport(tabId);
  const sanitizedFrame = capFrameReport(sanitizeFrameReportForStorage(frame));
  const frames = upsertFrame(current?.frames ?? [], sanitizedFrame).slice(0, REPORT_LIMITS.maxFramesPerReport);
  const summary = capSummary(summarizeFrameReports(frames), REPORT_LIMITS.maxFindingsPerReport);
  const report: StoredTabReport = {
    tabId,
    url: redactSensitiveUrl(topLevelUrl) ?? topLevelUrl,
    origin: getOrigin(topLevelUrl),
    summary,
    frames,
    updatedAt: now(),
  };

  await browser.storage.local.set({ [reportStorageKey(tabId)]: report });
  await enforceReportRetention(undefined, now());
  return report;
}

export async function saveTabReport(tabId: number, url: string, summary: AnalysisSummary, now: Now = systemNow): Promise<void> {
  const frame: FrameReport = {
    frameId: 0,
    parentFrameId: -1,
    frameUrl: url,
    frameOrigin: getOrigin(url),
    summary,
    updatedAt: now(),
  };
  await saveFrameReport(tabId, url, frame, now);
}

export async function getTabReport(tabId: number): Promise<StoredTabReport | null> {
  const key = reportStorageKey(tabId);
  const stored = await browser.storage.local.get(key);
  return (stored[key] as StoredTabReport | undefined) ?? null;
}

export async function clearTabReport(tabId: number): Promise<void> {
  await browser.storage.local.remove(reportStorageKey(tabId));
}

export async function listReports(): Promise<StoredTabReport[]> {
  const stored = await browser.storage.local.get(null);
  return Object.entries(stored)
    .filter(([key]) => key.startsWith(STORAGE_KEYS.reportsPrefix))
    .map(([, value]) => sanitizeStoredReportForExport(capStoredReport(value as StoredTabReport)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function clearAllReports(): Promise<void> {
  const stored = await browser.storage.local.get(null);
  const keys = Object.keys(stored).filter((key) => key.startsWith(STORAGE_KEYS.reportsPrefix));
  if (keys.length > 0) await browser.storage.local.remove(keys);
}

export async function pruneOldReports(policy?: SitePolicy, now: Now = systemNow): Promise<void> {
  await enforceReportRetention(policy, now());
}

export async function saveSitePolicy(policy: SitePolicy, now: Now = systemNow): Promise<void> {
  const normalizedPolicy = await persistSitePolicy(policy);
  await enforceReportRetention(normalizedPolicy, now());
}

export function emptyReport(tabId: number, url: string, now: Now = systemNow): StoredTabReport {
  return {
    tabId,
    url,
    origin: getOrigin(url),
    summary: { ...EMPTY_ANALYSIS_SUMMARY },
    frames: [],
    updatedAt: now(),
  };
}

function reportStorageKey(tabId: number): string {
  return `${STORAGE_KEYS.reportsPrefix}${tabId}`;
}
