import { browser } from "wxt/browser";

export type NavigationDetails = { tabId: number; url: string; frameId: number; parentFrameId?: number };
export type NavigationListener = { addListener(listener: (details: NavigationDetails) => void): void };
export type StorageChangeListener = { addListener(listener: (changes: Record<string, unknown>, areaName: string) => void): void };

export type OptionalBrowserEvents = {
  webNavigation?: {
    onBeforeNavigate?: NavigationListener;
    onCommitted?: NavigationListener;
    onErrorOccurred?: NavigationListener;
  };
  storage?: typeof browser.storage & { onChanged?: StorageChangeListener };
};

type BrowserWithOptionalEvents = typeof browser & OptionalBrowserEvents;

export function getOptionalBrowserEvents(): OptionalBrowserEvents {
  return browser as BrowserWithOptionalEvents;
}
