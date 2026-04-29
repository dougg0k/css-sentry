import { browser } from "wxt/browser";
import { ANALYSIS_LIMITS, DEFAULT_SITE_POLICY } from "../../shared/constants";
import type { SitePolicy } from "../../shared/types";
import { analyzeStylesheet } from "../../core/analyzer/analyzeStylesheet";
import { saveFrameReport } from "../storage/reports";
import { getOrigin } from "../../shared/url";

interface FilterResponseData {
  ondata: ((event: { data: ArrayBuffer }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  write(data: ArrayBuffer): void;
  close(): void;
  disconnect?(): void;
  error?: string;
}

type WebRequestDetails = {
  requestId: string;
  url: string;
  tabId?: number;
  frameId?: number;
  parentFrameId?: number;
  documentUrl?: string;
  originUrl?: string;
  initiator?: string;
};

type FirefoxWebRequest = {
  filterResponseData?: (requestId: string) => FilterResponseData;
  onBeforeRequest?: {
    addListener(listener: (details: WebRequestDetails) => void, filter: { urls: string[]; types?: string[] }, extraInfoSpec?: string[]): void;
  };
};

let activePolicy: SitePolicy = DEFAULT_SITE_POLICY;
let registered = false;

export function refreshFirefoxEnhancedPolicy(policy: SitePolicy): void {
  activePolicy = policy;
}

export function setupFirefoxEnhancedStylesheetInspection(): boolean {
  const runtimeBrowser = browser as typeof browser & { webRequest?: FirefoxWebRequest };
  const webRequest = runtimeBrowser.webRequest;
  if (registered || typeof webRequest?.filterResponseData !== "function" || typeof webRequest.onBeforeRequest?.addListener !== "function") return false;

  const listener = (details: WebRequestDetails) => {
    if (!activePolicy.compatibility.enableFirefoxEnhancedMode) return;
    if (typeof details.tabId !== "number" || details.tabId < 0) return;
    try {
      inspectStylesheetResponse(webRequest, details);
    } catch {
      // Firefox enhanced inspection is optional. It must never break normal browsing.
    }
  };

  try {
    webRequest.onBeforeRequest.addListener(listener, { urls: ["<all_urls>"], types: ["stylesheet"] }, ["blocking"]);
    registered = true;
    return true;
  } catch {
    try {
      webRequest.onBeforeRequest.addListener(listener, { urls: ["<all_urls>"], types: ["stylesheet"] });
      registered = true;
      return true;
    } catch {
      return false;
    }
  }
}

function inspectStylesheetResponse(webRequest: FirefoxWebRequest, details: WebRequestDetails): void {
  const filter = webRequest.filterResponseData?.(details.requestId);
  if (!filter) return;
  const chunks: ArrayBuffer[] = [];
  let totalBytes = 0;

  filter.ondata = (event) => {
    const copy = event.data.slice(0);
    totalBytes += copy.byteLength;
    if (totalBytes <= ANALYSIS_LIMITS.maxStyleTextBytes) chunks.push(copy);
    filter.write(event.data);
  };

  filter.onerror = () => {
    try { filter.disconnect?.(); } catch {}
  };

  filter.onstop = () => {
    try { filter.close(); } catch {}
    if (totalBytes > ANALYSIS_LIMITS.maxStyleTextBytes) return;
    const cssText = decodeChunks(chunks);
    if (!cssText.trim()) return;
    const frameUrl = details.documentUrl ?? details.originUrl ?? details.initiator ?? details.url;
    const summary = analyzeStylesheet({
      cssText,
      pageUrl: frameUrl,
      frameUrl,
      sourceKind: "stylesheet",
      sourceUrl: details.url,
    });
    if (summary.findings.length === 0) return;
    void saveFrameReport(details.tabId as number, frameUrl, {
      frameId: typeof details.frameId === "number" ? details.frameId : 0,
      parentFrameId: typeof details.parentFrameId === "number" ? details.parentFrameId : -1,
      frameUrl,
      frameOrigin: getOrigin(frameUrl),
      summary,
      updatedAt: Date.now(),
    });
  };
}

function decodeChunks(chunks: ArrayBuffer[]): string {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return chunks.map((chunk, index) => decoder.decode(chunk, { stream: index < chunks.length - 1 })).join("") + decoder.decode();
}
