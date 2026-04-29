import { browser } from "wxt/browser";
import { DEFAULT_SITE_POLICY, EMPTY_ANALYSIS_SUMMARY, POLICY_LIMITS, REPORT_LIMITS, STORAGE_KEYS } from "../../shared/constants";
import type { AnalysisSummary, ExtensionMode, FrameReport, SitePolicy, StoredTabReport } from "../../shared/types";
import { getOrigin, isPolicyOrigin } from "../../shared/url";
import { mergeSummaries } from "../scanner/summarize";
import { sanitizeFrameReportForStorage, sanitizeStoredReportForExport } from "../../core/privacy/redaction";

const VALID_MODES = new Set<ExtensionMode>([
  "default",
  "passive",
  "balanced",
  "strict",
  "always_scan_never_sanitize",
  "never_scan_never_sanitize",
  "paused",
  "trusted",
]);

export async function saveFrameReport(tabId: number, topLevelUrl: string, frame: FrameReport): Promise<StoredTabReport> {
  const current = await getTabReport(tabId);
  const sanitizedFrame = capFrameReport(sanitizeFrameReportForStorage(frame));
  const frames = upsertFrame(current?.frames ?? [], sanitizedFrame).slice(0, REPORT_LIMITS.maxFramesPerReport);
  const summary = capSummary(mergeSummaries(frames.map((item) => item.summary)), REPORT_LIMITS.maxFindingsPerReport);
  const report: StoredTabReport = sanitizeStoredReportForExport({ tabId, url: topLevelUrl, origin: getOrigin(topLevelUrl), summary, frames, updatedAt: Date.now() });
  await browser.storage.local.set({ [`${STORAGE_KEYS.reportsPrefix}${tabId}`]: report });
  await enforceReportRetention();
  return report;
}

export async function saveTabReport(tabId: number, url: string, summary: AnalysisSummary): Promise<void> {
  const frame: FrameReport = { frameId: 0, parentFrameId: -1, frameUrl: url, frameOrigin: getOrigin(url), summary, updatedAt: Date.now() };
  await saveFrameReport(tabId, url, frame);
}

export async function getTabReport(tabId: number): Promise<StoredTabReport | null> {
  const key = `${STORAGE_KEYS.reportsPrefix}${tabId}`;
  const stored = await browser.storage.local.get(key);
  return (stored[key] as StoredTabReport | undefined) ?? null;
}

export async function clearTabReport(tabId: number): Promise<void> {
  await browser.storage.local.remove(`${STORAGE_KEYS.reportsPrefix}${tabId}`);
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

export async function pruneOldReports(policy?: SitePolicy): Promise<void> {
  const effectivePolicy = policy ?? await getSitePolicy();
  const cutoff = Date.now() - effectivePolicy.logRetentionDays * 86_400_000;
  const stored = await browser.storage.local.get(null);
  const keys = Object.entries(stored).filter(([key, value]) => key.startsWith(STORAGE_KEYS.reportsPrefix) && (value as StoredTabReport).updatedAt < cutoff).map(([key]) => key);
  if (keys.length > 0) await browser.storage.local.remove(keys);
  await enforceReportRetention();
}

export async function getSitePolicy(): Promise<SitePolicy> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.settings);
  return normalizePolicy(stored[STORAGE_KEYS.settings] as Partial<SitePolicy> | undefined);
}

export async function saveSitePolicy(policy: SitePolicy): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.settings]: normalizePolicy(policy) });
}

export function parseImportedSitePolicy(text: string): SitePolicy {
  if (byteLength(text) > POLICY_LIMITS.maxImportedSettingsBytes) {
    throw new Error(`Settings import exceeds ${POLICY_LIMITS.maxImportedSettingsBytes} bytes.`);
  }
  const parsed = JSON.parse(text) as unknown;
  if (!isPlainObject(parsed)) throw new Error("Settings import must be a JSON object.");
  return normalizePolicy(parsed as Partial<SitePolicy>);
}

export function normalizePolicy(policy?: Partial<SitePolicy> | Record<string, unknown>): SitePolicy {
  const plainPolicy: Record<string, unknown> = isPlainObject(policy) ? policy : {};

  const perOriginModes = Object.fromEntries(
    Object.entries(isPlainObject(plainPolicy.perOriginModes) ? plainPolicy.perOriginModes : DEFAULT_SITE_POLICY.perOriginModes)
      .filter(([origin, mode]) => isPolicyOrigin(origin) && origin.length <= POLICY_LIMITS.maxOriginLength && typeof mode === "string" && mode !== "default" && VALID_MODES.has(mode as ExtensionMode))
      .slice(0, POLICY_LIMITS.maxPerOriginModes)
  ) as SitePolicy["perOriginModes"];

  const rawMode = typeof plainPolicy.mode === "string" && VALID_MODES.has(plainPolicy.mode as ExtensionMode) ? plainPolicy.mode as ExtensionMode : DEFAULT_SITE_POLICY.mode;
  const logRetentionDays = clampInteger(plainPolicy.logRetentionDays, DEFAULT_SITE_POLICY.logRetentionDays, POLICY_LIMITS.minLogRetentionDays, POLICY_LIMITS.maxLogRetentionDays);
  const compatibility = isPlainObject(plainPolicy.compatibility) ? plainPolicy.compatibility : {};

  return {
    ...DEFAULT_SITE_POLICY,
    mode: rawMode,
    advancedModeEnabled: typeof plainPolicy.advancedModeEnabled === "boolean" ? plainPolicy.advancedModeEnabled : DEFAULT_SITE_POLICY.advancedModeEnabled,
    trustedOrigins: cleanOriginList(Array.isArray(plainPolicy.trustedOrigins) ? plainPolicy.trustedOrigins : DEFAULT_SITE_POLICY.trustedOrigins),
    blockedOrigins: cleanOriginList(Array.isArray(plainPolicy.blockedOrigins) ? plainPolicy.blockedOrigins : DEFAULT_SITE_POLICY.blockedOrigins),
    strictOrigins: cleanOriginList(Array.isArray(plainPolicy.strictOrigins) ? plainPolicy.strictOrigins : DEFAULT_SITE_POLICY.strictOrigins),
    allowlistedOrigins: cleanOriginList(Array.isArray(plainPolicy.allowlistedOrigins) ? plainPolicy.allowlistedOrigins : DEFAULT_SITE_POLICY.allowlistedOrigins),
    blocklistedOrigins: cleanOriginList(Array.isArray(plainPolicy.blocklistedOrigins) ? plainPolicy.blocklistedOrigins : DEFAULT_SITE_POLICY.blocklistedOrigins),
    perOriginModes,
    logRetentionDays,
    compatibility: {
      neverFetchRemoteCssFromExtension: booleanOrDefault(compatibility.neverFetchRemoteCssFromExtension, DEFAULT_SITE_POLICY.compatibility.neverFetchRemoteCssFromExtension),
      enableDnrMitigation: booleanOrDefault(compatibility.enableDnrMitigation, DEFAULT_SITE_POLICY.compatibility.enableDnrMitigation),
      enableStrictThirdPartyBlocking: booleanOrDefault(compatibility.enableStrictThirdPartyBlocking, DEFAULT_SITE_POLICY.compatibility.enableStrictThirdPartyBlocking),
      showPartialAnalysisFindings: booleanOrDefault(compatibility.showPartialAnalysisFindings, DEFAULT_SITE_POLICY.compatibility.showPartialAnalysisFindings),
      enableFirefoxEnhancedMode: booleanOrDefault(compatibility.enableFirefoxEnhancedMode, DEFAULT_SITE_POLICY.compatibility.enableFirefoxEnhancedMode),
      reportExternalSvgImageDocuments: booleanOrDefault(compatibility.reportExternalSvgImageDocuments, DEFAULT_SITE_POLICY.compatibility.reportExternalSvgImageDocuments),
      enableSvgImageDnrPolicy: booleanOrDefault(compatibility.enableSvgImageDnrPolicy, DEFAULT_SITE_POLICY.compatibility.enableSvgImageDnrPolicy),
    }
  };
}

function cleanOriginList(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length <= POLICY_LIMITS.maxOriginLength && isPolicyOrigin(value)))]
    .slice(0, POLICY_LIMITS.maxOriginsPerList)
    .sort();
}

function upsertFrame(frames: FrameReport[], frame: FrameReport): FrameReport[] {
  const next = frames.filter((item) => item.frameId !== frame.frameId);
  next.push(frame);
  return next.sort((a, b) => a.frameId - b.frameId);
}

export function emptyReport(tabId: number, url: string): StoredTabReport {
  return { tabId, url, origin: getOrigin(url), summary: { ...EMPTY_ANALYSIS_SUMMARY }, frames: [], updatedAt: Date.now() };
}

function capStoredReport(report: StoredTabReport): StoredTabReport {
  const frames = (report.frames ?? []).slice(0, REPORT_LIMITS.maxFramesPerReport).map(capFrameReport);
  return {
    ...report,
    frames,
    summary: capSummary(report.summary ?? mergeSummaries(frames.map((frame) => frame.summary)), REPORT_LIMITS.maxFindingsPerReport),
  };
}

function capFrameReport(frame: FrameReport): FrameReport {
  return {
    ...frame,
    summary: capSummary(frame.summary, REPORT_LIMITS.maxFindingsPerFrame),
  };
}

function capSummary(summary: AnalysisSummary, maxFindings: number): AnalysisSummary {
  return {
    ...summary,
    findings: (summary.findings ?? []).slice(0, maxFindings),
    analyzedStylesheets: clampCount(summary.analyzedStylesheets),
    partialStylesheets: clampCount(summary.partialStylesheets),
    analyzedFrames: clampCount(summary.analyzedFrames),
    partialFrames: clampCount(summary.partialFrames),
  };
}

async function enforceReportRetention(): Promise<void> {
  const stored = await browser.storage.local.get(null);
  const reportEntries = Object.entries(stored)
    .filter(([key]) => key.startsWith(STORAGE_KEYS.reportsPrefix))
    .sort((a, b) => ((b[1] as StoredTabReport).updatedAt ?? 0) - ((a[1] as StoredTabReport).updatedAt ?? 0));

  const staleKeys = reportEntries.slice(REPORT_LIMITS.maxReportsRetained).map(([key]) => key);
  if (staleKeys.length > 0) await browser.storage.local.remove(staleKeys);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function clampCount(value: number): number {
  return Math.max(0, Math.min(Number.isFinite(value) ? Math.trunc(value) : 0, 10_000));
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
  return value.length;
}
