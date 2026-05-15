import { browser } from "wxt/browser";

export interface BadgeActionApi {
  setBadgeText(details: { tabId: number; text: string }): Promise<void> | void;
  setBadgeBackgroundColor(details: { tabId: number; color: string }): Promise<void> | void;
}

export interface BrowserBadgeActionApis {
  action?: Partial<BadgeActionApi>;
  browserAction?: Partial<BadgeActionApi>;
}

export function getBadgeActionApi(): BadgeActionApi | null {
  return selectBadgeActionApi(browser as BrowserBadgeActionApis);
}

export function selectBadgeActionApi(apis: BrowserBadgeActionApis): BadgeActionApi | null {
  if (isBadgeActionApi(apis.action)) return apis.action;
  if (isBadgeActionApi(apis.browserAction)) return apis.browserAction;
  return null;
}

function isBadgeActionApi(value: unknown): value is BadgeActionApi {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BadgeActionApi>;
  return typeof candidate.setBadgeText === "function" && typeof candidate.setBadgeBackgroundColor === "function";
}
