import { browser } from "wxt/browser";

export interface FilterResponseData {
  ondata: ((event: { data: ArrayBuffer }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  write(data: ArrayBuffer): void;
  close(): void;
  disconnect?(): void;
  error?: string;
}

export type WebRequestDetails = {
  requestId: string;
  url: string;
  tabId?: number;
  frameId?: number;
  parentFrameId?: number;
  documentUrl?: string;
  originUrl?: string;
  initiator?: string;
};

export type FirefoxWebRequest = {
  filterResponseData?: (requestId: string) => FilterResponseData | undefined;
  onBeforeRequest?: {
    addListener(listener: (details: WebRequestDetails) => void, filter: { urls: string[]; types?: string[] }, extraInfoSpec?: string[]): void;
  };
};

export type FirefoxWebRequestFilteringApi = FirefoxWebRequest & {
  filterResponseData: (requestId: string) => FilterResponseData | undefined;
  onBeforeRequest: {
    addListener(listener: (details: WebRequestDetails) => void, filter: { urls: string[]; types?: string[] }, extraInfoSpec?: string[]): void;
  };
};

type BrowserWithFirefoxWebRequest = typeof browser & { webRequest?: FirefoxWebRequest };

export function getFirefoxWebRequestApi(): FirefoxWebRequestFilteringApi | null {
  const webRequest = (browser as BrowserWithFirefoxWebRequest).webRequest;
  if (typeof webRequest?.filterResponseData !== "function") return null;
  if (typeof webRequest.onBeforeRequest?.addListener !== "function") return null;
  return webRequest as FirefoxWebRequestFilteringApi;
}
