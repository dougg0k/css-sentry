import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { DEFAULT_SITE_POLICY, STORAGE_KEYS } from "../shared/constants";
import type { AnalysisSummary, ExtensionMode, MitigationAction, SitePolicy, Finding, ScanCompleteResponse } from "../shared/types";
import { applyGlobalPolicyDnrRules, applyTabPolicyDnrRules, blockHighConfidenceFindingUrls, clearTabDnrRules } from "../browser/dnr/chromeDnr";
import { clearTabReport, getSitePolicy, pruneOldReports, saveFrameReport, saveSitePolicy } from "../browser/storage/reports";
import { effectiveModeForUrl, setOriginMode, shouldMitigate, shouldScan, shouldStrictBlockThirdParty } from "../core/policy/mode";
import { getOrigin } from "../shared/url";
import { systemNow } from "../shared/clock";
import { validateRuntimeMessage } from "../browser/runtime/messageSecurity";
import { refreshFirefoxEnhancedPolicy, setupFirefoxEnhancedStylesheetInspection } from "../browser/firefox/enhancedStylesheetInspection";
import { createCrossOriginSubframePartialReport } from "../browser/scanner/navigationFrameCoverage";
import { getOptionalBrowserEvents, type NavigationDetails } from "../browser/platform/browserEvents";

const topLevelUrlsByTabId = new Map<number, string>();

export default defineBackground(() => {
  const runtimeBrowser = getOptionalBrowserEvents();

  browser.runtime.onInstalled.addListener(() => { void handleInstalled(); });
  browser.runtime.onStartup?.addListener(() => { void handleStartup(); });
  browser.tabs?.onRemoved?.addListener((tabId: number) => {
    topLevelUrlsByTabId.delete(tabId);
    void clearTabDnrRules(tabId);
  });
  setupFirefoxEnhancedStylesheetInspection();

  runtimeBrowser.storage?.onChanged?.addListener((changes: Record<string, unknown>, areaName: string) => {
    if (areaName !== "local" || !(STORAGE_KEYS.settings in changes)) return;
    void handlePolicyChanged();
  });

  runtimeBrowser.webNavigation?.onBeforeNavigate?.addListener((details) => {
    if (details.frameId !== 0) {
      void recordSubframeNavigationPartialCoverage(details);
      return;
    }
    rememberTopLevelUrl(details.tabId, details.url);
    void applyEarlyNavigationPolicy(details.tabId, details.url);
  });

  runtimeBrowser.webNavigation?.onCommitted?.addListener((details) => {
    if (details.frameId !== 0) {
      void recordSubframeNavigationPartialCoverage(details);
      return;
    }
    rememberTopLevelUrl(details.tabId, details.url);
    void applyEarlyNavigationPolicy(details.tabId, details.url);
  });

  runtimeBrowser.webNavigation?.onErrorOccurred?.addListener((details) => {
    if (details.frameId === 0) return;
    void recordSubframeNavigationPartialCoverage(details);
  });

  browser.runtime.onMessage.addListener((unknownMessage: unknown, sender: { tab?: { id?: number; url?: string }; frameId?: number; parentFrameId?: number }) => {
    const validation = validateRuntimeMessage(unknownMessage, sender);
    if (!validation.ok || !validation.message) return;
    const message = validation.message;

    if (message.type === "css-sentry:scan-complete") {
      const tabId = typeof sender.tab?.id === "number" ? sender.tab.id : null;
      const frameId = typeof sender.frameId === "number" ? sender.frameId : null;
      if (tabId === null || frameId === null) return;
      const topLevelUrl = typeof sender.tab?.url === "string" ? sender.tab.url : message.url;
      return handleScanComplete(tabId, topLevelUrl, frameId, getParentFrameId(sender), message.url, message.summary);
    }

    if (message.type === "css-sentry:set-origin-mode") return handleSetOriginMode(message.origin, message.mode);
    if (message.type === "css-sentry:clear-current-report") return clearTabReport(message.tabId).then(() => clearTabDnrRules(message.tabId));
    if (message.type === "css-sentry:policy-updated") return handlePolicyChanged();
  });
});

function rememberTopLevelUrl(tabId: number, url: string): void {
  topLevelUrlsByTabId.set(tabId, url);
}

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

async function recordSubframeNavigationPartialCoverage(details: NavigationDetails): Promise<void> {
  const topLevelUrl = await getTabUrl(details.tabId);
  if (!topLevelUrl) return;

  const policy = await getSitePolicy();
  const mode = effectiveModeForUrl(topLevelUrl, policy);
  if (!shouldScan(mode)) return;

  const frame = createCrossOriginSubframePartialReport({
    tabId: details.tabId,
    topLevelUrl,
    frameId: details.frameId,
    parentFrameId: typeof details.parentFrameId === "number" ? details.parentFrameId : 0,
    frameUrl: details.url,
  });
  if (!frame) return;

  const report = await saveFrameReport(details.tabId, topLevelUrl, frame);
  await updateBadge(details.tabId, report.summary);
}

async function getTabUrl(tabId: number): Promise<string | null> {
  const rememberedUrl = topLevelUrlsByTabId.get(tabId);
  if (rememberedUrl) return rememberedUrl;

  try {
    const tab = await browser.tabs.get(tabId);
    return typeof tab.url === "string" ? tab.url : null;
  } catch {
    return null;
  }
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
  await Promise.all(tabs.map(async (tab: { id?: number; url?: string }) => {
    if (tab.id === undefined || !tab.url) return;
    const mode = effectiveModeForUrl(tab.url, policy);
    await applyTabPolicyDnrRules(tab.id, tab.url, policy, shouldStrictBlockThirdParty(mode));
  }));
}

async function handleScanComplete(tabId: number, topLevelUrl: string, frameId: number, parentFrameId: number, frameUrl: string, summary: AnalysisSummary): Promise<ScanCompleteResponse> {
  const policy = await getSitePolicy();
  const mode = effectiveModeForUrl(topLevelUrl, policy);
  let finalSummary = summary;

  await applyTabPolicyDnrRules(tabId, topLevelUrl, policy, shouldStrictBlockThirdParty(mode));

  if (policy.compatibility.enableDnrMitigation && shouldMitigate(mode)) {
    const blockResult = await blockHighConfidenceFindingUrls(summary.findings, tabId, policy, mode);
    if (blockResult.blockedFindings.size > 0 || blockResult.ruleInstalledFindings.size > 0 || blockResult.skippedAllowedUrls.length > 0) {
      finalSummary = {
        ...summary,
        findings: summary.findings.map((finding) => {
          if (blockResult.blockedFindings.has(finding.id)) return withMitigationAction(finding, "blocked_dnr");
          if (blockResult.ruleInstalledFindings.has(finding.id)) return withMitigationAction(finding, "rule_installed_dnr");
          return finding;
        })
      };
    }
  }

  const report = await saveFrameReport(tabId, topLevelUrl, { frameId, parentFrameId, frameUrl, frameOrigin: getOrigin(frameUrl), summary: finalSummary, updatedAt: systemNow() });
  await updateBadge(tabId, report.summary);
  return scanCompleteResponse(report.summary);
}


function scanCompleteResponse(summary: AnalysisSummary): ScanCompleteResponse {
  const reasons = new Set<ScanCompleteResponse["reasons"][number]>();
  const actions = new Set<ScanCompleteResponse["actions"][number]>();

  for (const finding of summary.findings) {
    finding.reasons.forEach((reason) => reasons.add(reason));
    actions.add(finding.action);
    finding.additionalActions?.forEach((action) => actions.add(action));
  }

  return {
    ok: true,
    reportSaved: true,
    state: summary.state,
    findingCount: summary.findings.length,
    actionableFindingCount: summary.findings.filter((finding) => finding.severity !== "info").length,
    reasons: [...reasons].sort(),
    actions: [...actions].sort(),
  };
}

function withMitigationAction(finding: Finding, action: MitigationAction): Finding {
  if (finding.action === action) return finding;
  const pageChangingActions = new Set<MitigationAction>(["neutralized", "disabled_stylesheet", "removed_style_node"]);
  if (pageChangingActions.has(finding.action) && (action === "blocked_dnr" || action === "rule_installed_dnr")) {
    const additionalActions = [...new Set([...(finding.additionalActions ?? []), action])];
    return { ...finding, additionalActions };
  }
  const additionalActions = (finding.additionalActions ?? []).filter((existing) => existing !== action);
  return additionalActions.length > 0 ? { ...finding, action, additionalActions } : { ...finding, action };
}

async function updateBadge(tabId: number, summary: AnalysisSummary): Promise<void> {
  const actionable = summary.findings.filter((finding) => finding.severity !== "info").length;
  await browser.action.setBadgeText({ tabId, text: actionable > 0 ? String(Math.min(actionable, 99)) : "" });
  await browser.action.setBadgeBackgroundColor({ tabId, color: summary.state === "analysis.complete" ? "#2563eb" : "#f59e0b" });
}
