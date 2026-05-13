import { hasDeclarativeNetRequestSessionRuleApi } from "./dnrApi";
import { getFirefoxWebRequestApi } from "./firefoxWebRequestApi";

export interface BrowserCapabilities {
  declarativeNetRequestSessionRules: boolean;
  firefoxResponseFiltering: boolean;
}

export function readBrowserCapabilities(): BrowserCapabilities {
  return {
    declarativeNetRequestSessionRules: hasDeclarativeNetRequestSessionRuleApi(),
    firefoxResponseFiltering: getFirefoxWebRequestApi() !== null,
  };
}
