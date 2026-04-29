import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { DEFAULT_SITE_POLICY, STORAGE_KEYS } from "../shared/constants";
import type { AnalysisSummary, ExtensionMode, SitePolicy } from "../shared/types";
import { applyGlobalPolicyDnrRules, applyTabPolicyDnrRules, blockHighConfidenceFindingUrls, clearTabDnrRules } from "../browser/dnr/chromeDnr";
import { clearTabReport, getSitePolicy, pruneOldReports, saveFrameReport, saveSitePolicy } from "../browser/storage/reports";
import { effectiveModeForUrl, setOriginMode, shouldMitigate, shouldStrictBlockThirdParty } from "../core/policy/mode";
import { getOrigin } from "../shared/url";
import { validateRuntimeMessage } from "../browser/runtime/messageSecurity";
import { refreshFirefoxEnhancedPolicy, setupFirefoxEnhancedStylesheetInspection } from "../browser/firefox/enhancedStylesheetInspection";

type NavigationDetails = { tabId: number; url: string; frameId: number };
type NavigationListener = { addListener(listener: (details: NavigationDetails) => void): void };
type StorageChangeListener = { addListener(listener: (changes: Record<string, unknown>, areaName: string) => void): void };
type BrowserWithOptionalEvents = typeof browser & {
  webNavigation?: { onBeforeNavigate?: NavigationListener; onCommitted?: NavigationListener };
  storage?: typeof browser.storage & { onChanged?: StorageChangeListener };
};

export default defineBackground(() => {
  const runtimeBrowser = browser as BrowserWithOptionalEvents;

  browser.runtime.onInstalled.addListener(() => { void handleInstalled(); });
  browser.runtime.onStartup?.addListener(() => { void handleStartup(); });
  browser.tabs?.onRemoved?.addListener((tabId) => { void clearTabDnrRules(tabId); });
  setupFirefoxEnhancedStylesheetInspection();

  runtimeBrowser.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !(STORAGE_KEYS.settings in changes)) return;
    void handlePolicyChanged();
  });

  runtimeBrowser.webNavigation?.onBeforeNavigate?.addListener((details) => {
    if (details.frameId !== 0) return;
    void applyEarlyNavigationPolicy(details.tabId, details.url);
  });

  runtimeBrowser.webNavigation?.onCommitted?.addListener((details) => {
    if (details.frameId !== 0) return;
    void applyEarlyNavigationPolicy(details.tabId, details.url);
  });

  browser.runtime.onMessage.addListener((unknownMessage, sender) => {
    const validation = validateRuntimeMessage(unknownMessage, sender);
    if (!validation.ok || !validation.message) return;
    const message = validation.message;

    if (message.type === "css-sentry:scan-complete") {
      const tabId = typeof sender.tab?.id === "number" ? sender.tab.id : null;
      const frameId = typeof sender.frameId === "number" ? sender.frameId : null;
      if (tabId === null || frameId === null) return;
      const topLevelUrl = typeof sender.tab?.url === "string" ? sender.tab.url : message.url;
      void handleScanComplete(tabId, topLevelUrl, frameId, getParentFrameId(sender), message.url, message.summary);
      return;
    }

    if (message.type === "css-sentry:set-origin-mode") return handleSetOriginMode(message.origin, message.mode);
    if (message.type === "css-sentry:clear-current-report") return clearTabReport(message.tabId).then(() => clearTabDnrRules(message.tabId));
    if (message.type === "css-sentry:policy-updated") return handlePolicyChanged();
  });
});

function getParentFrameId(sender: unknown): number {
  const candidate = typeof sender === "object" && sender !== null ? (sender as { parentFrameId?: unknown }).parentFrameId : undefined;
  return typeof candidate === "number" ? candidate : -1;
}

async function handleInstalled(): Promise<void> {
  const current = await browser.storage.local.get(STORAGE_KEYS.settings);
  if (!current[STORAGE_KEYS.settings]) await browser.storage.local.set({ [STORAGE_KEYS.settings]: DEFAULT_SITE_POLICY });
  await handlePolicyChanged();
}

async function handleStartup(): Promise<void> {
  await pruneOldReports();
  await handlePolicyChanged();
}

async function handlePolicyChanged(): Promise<void> {
  const policy = await getSitePolicy();
  refreshFirefoxEnhancedPolicy(policy);
  await applyGlobalPolicyDnrRules(policy);
  await refreshOpenTabPolicies(policy);
}

async function applyEarlyNavigationPolicy(tabId: number, url: string): Promise<void> {
  const policy = await getSitePolicy();
  const mode = effectiveModeForUrl(url, policy);
  await applyTabPolicyDnrRules(tabId, url, policy, shouldStrictBlockThirdParty(mode));
}

async function handleSetOriginMode(origin: string, mode: ExtensionMode): Promise<void> {
  const policy = await getSitePolicy();
  const nextPolicy = setOriginMode(policy, origin, mode);
  await saveSitePolicy(nextPolicy);
  await handlePolicyChanged();
}

async function refreshOpenTabPolicies(policy: SitePolicy): Promise<void> {
  const tabs = await browser.tabs?.query?.({}) ?? [];
  await Promise.all(tabs.map(async (tab) => {
    if (tab.id === undefined || !tab.url) return;
    const mode = effectiveModeForUrl(tab.url, policy);
    await applyTabPolicyDnrRules(tab.id, tab.url, policy, shouldStrictBlockThirdParty(mode));
  }));
}

async function handleScanComplete(tabId: number, topLevelUrl: string, frameId: number, parentFrameId: number, frameUrl: string, summary: AnalysisSummary): Promise<void> {
  const policy = await getSitePolicy();
  const mode = effectiveModeForUrl(topLevelUrl, policy);
  let finalSummary = summary;

  await applyTabPolicyDnrRules(tabId, topLevelUrl, policy, shouldStrictBlockThirdParty(mode));

  if (policy.compatibility.enableDnrMitigation && shouldMitigate(mode)) {
    const blockResult = await blockHighConfidenceFindingUrls(summary.findings, tabId, policy);
    if (blockResult.blockedFindings.size > 0 || blockResult.skippedAllowedUrls.length > 0) {
      finalSummary = {
        ...summary,
        findings: summary.findings.map((finding) => {
          if (blockResult.blockedFindings.has(finding.id)) return { ...finding, action: "blocked_dnr" };
          return finding;
        })
      };
    }
  }

  const report = await saveFrameReport(tabId, topLevelUrl, { frameId, parentFrameId, frameUrl, frameOrigin: getOrigin(frameUrl), summary: finalSummary, updatedAt: Date.now() });
  await updateBadge(tabId, report.summary);
}

async function updateBadge(tabId: number, summary: AnalysisSummary): Promise<void> {
  const actionable = summary.findings.filter((finding) => finding.severity !== "info").length;
  await browser.action.setBadgeText({ tabId, text: actionable > 0 ? String(Math.min(actionable, 99)) : "" });
  await browser.action.setBadgeBackgroundColor({ tabId, color: summary.state === "analysis.complete" ? "#2563eb" : "#f59e0b" });
}
