import { browser } from "wxt/browser";
import type { SessionRuleLike } from "../dnr/dnrRuleAllocation";

type DeclarativeNetRequestApi = typeof browser.declarativeNetRequest & {
  getSessionRules?: () => Promise<SessionRuleLike[]>;
};

export function getDeclarativeNetRequestApi(): DeclarativeNetRequestApi | null {
  const api = browser.declarativeNetRequest as DeclarativeNetRequestApi | undefined;
  return typeof api?.updateSessionRules === "function" ? api : null;
}

export function hasDeclarativeNetRequestSessionRuleApi(): boolean {
  return getDeclarativeNetRequestApi() !== null;
}

export async function getSessionRules(api: DeclarativeNetRequestApi = requiredDeclarativeNetRequestApi()): Promise<SessionRuleLike[]> {
  if (typeof api.getSessionRules !== "function") return [];
  try {
    return await api.getSessionRules();
  } catch {
    return [];
  }
}

export async function updateSessionRules(
  update: Parameters<DeclarativeNetRequestApi["updateSessionRules"]>[0],
  api: DeclarativeNetRequestApi = requiredDeclarativeNetRequestApi(),
): Promise<void> {
  await api.updateSessionRules(update);
}

function requiredDeclarativeNetRequestApi(): DeclarativeNetRequestApi {
  const api = getDeclarativeNetRequestApi();
  if (!api) throw new Error("declarativeNetRequest.updateSessionRules is unavailable.");
  return api;
}
