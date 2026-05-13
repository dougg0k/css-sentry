import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import { getSitePolicy, getTabReport, saveSitePolicy } from "../../browser/storage/reports";
import { useTransientValue } from "../../shared/hooks/useTransientValue";
import type { ExtensionMode, SitePolicy, StoredTabReport } from "../../shared/types";
import { getModeDefinition } from "../../shared/uiMetadata";
import { activeTabState, derivePopupViewState } from "./popupDerivedState";

const SAVED_MODE_NOTICE_MS = 1_500;

type ActiveTabState = ReturnType<typeof activeTabState>;

export interface PopupStateController {
  activeTab: ActiveTabState;
  report: StoredTabReport | null;
  policy: SitePolicy | null;
  error: string | null;
  savedMode: string | null;
  view: ReturnType<typeof derivePopupViewState>;
  refresh(): Promise<void>;
  setGlobalMode(nextMode: ExtensionMode): Promise<void>;
  clearReport(): Promise<void>;
  openPage(page: "options" | "report"): Promise<void>;
}

export function usePopupState(): PopupStateController {
  const [activeTab, setActiveTab] = useState<ActiveTabState>(null);
  const [report, setReport] = useState<StoredTabReport | null>(null);
  const [policy, setPolicy] = useState<SitePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMode, showSavedMode] = useTransientValue<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const nextActiveTab = activeTabState(tab);
      if (!nextActiveTab) {
        setError("No active tab found.");
        return;
      }
      setActiveTab(nextActiveTab);
      setReport(await getTabReport(nextActiveTab.id));
      setPolicy(await getSitePolicy());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load CSS Sentry report.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setGlobalMode(nextMode: ExtensionMode): Promise<void> {
    const basePolicy = policy ?? await getSitePolicy();
    const nextPolicy: SitePolicy = { ...basePolicy, mode: nextMode };
    setPolicy(nextPolicy);
    await saveSitePolicy(nextPolicy);
    showSavedMode(getModeDefinition(nextMode).label, SAVED_MODE_NOTICE_MS);
  }

  async function clearReport(): Promise<void> {
    if (!activeTab?.id) return;
    await browser.runtime.sendMessage({ type: "css-sentry:clear-current-report", tabId: activeTab.id });
    await refresh();
  }

  async function openPage(page: "options" | "report"): Promise<void> {
    const url = browser.runtime.getURL(page === "options" ? "/options.html" : "/report.html");
    await browser.tabs.create({ url });
  }

  const view = useMemo(() => derivePopupViewState(report, policy, activeTab), [report, policy, activeTab]);

  return {
    activeTab,
    report,
    policy,
    error,
    savedMode,
    view,
    refresh,
    setGlobalMode,
    clearReport,
    openPage,
  };
}
