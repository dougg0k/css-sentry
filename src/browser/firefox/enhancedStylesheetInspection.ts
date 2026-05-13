import { ANALYSIS_LIMITS, DEFAULT_SITE_POLICY } from "../../shared/constants";
import { systemNow } from "../../shared/clock";
import type { AnalysisSummary, SitePolicy } from "../../shared/types";
import { analyzeStylesheet } from "../../core/analyzer/analyzeStylesheet";
import { saveFrameReport } from "../storage/reports";
import { getOrigin } from "../../shared/url";
import { createPerformanceBudgetSummary } from "../scanner/coverageSummary";
import { mergeSummaries } from "../scanner/summarize";
import { getFirefoxWebRequestApi, type FirefoxWebRequest, type WebRequestDetails, type FilterResponseData } from "../platform/firefoxWebRequestApi";
export type { FilterResponseData, FirefoxWebRequest, WebRequestDetails } from "../platform/firefoxWebRequestApi";

export interface FirefoxStylesheetInspectionDependencies {
  analyze: typeof analyzeStylesheet;
  saveFrameReport: typeof saveFrameReport;
  now: () => number;
  maxRetainedBytes: number;
}

const DEFAULT_DEPENDENCIES: FirefoxStylesheetInspectionDependencies = {
  analyze: analyzeStylesheet,
  saveFrameReport,
  now: systemNow,
  maxRetainedBytes: ANALYSIS_LIMITS.maxStyleTextBytes,
};

let activePolicy: SitePolicy = DEFAULT_SITE_POLICY;
let registered = false;

export function refreshFirefoxEnhancedPolicy(policy: SitePolicy): void {
  activePolicy = policy;
}

export function setupFirefoxEnhancedStylesheetInspection(): boolean {
  const webRequest = getFirefoxWebRequestApi();
  if (registered || webRequest === null) return false;

  const listener = (details: WebRequestDetails) => {
    try {
      inspectFirefoxStylesheetResponse(webRequest, details, activePolicy);
    } catch {
      // Firefox enhanced inspection is optional. It must never break normal browsing.
    }
  };

  try {
    webRequest.onBeforeRequest.addListener(listener, { urls: ["<all_urls>"], types: ["stylesheet"] }, ["blocking"]);
    registered = true;
    return true;
  } catch {
    return false;
  }
}

export function inspectFirefoxStylesheetResponse(
  webRequest: FirefoxWebRequest,
  details: WebRequestDetails,
  policy: SitePolicy,
  dependencies: FirefoxStylesheetInspectionDependencies = DEFAULT_DEPENDENCIES,
): boolean {
  if (!policy.compatibility.enableFirefoxEnhancedMode) return false;
  if (typeof details.tabId !== "number" || details.tabId < 0) return false;
  if (typeof webRequest.filterResponseData !== "function") return false;

  const filter = webRequest.filterResponseData(details.requestId);
  if (!filter) return false;

  const capture = createBoundedResponseCapture(dependencies.maxRetainedBytes);
  let streamWriteFailed = false;

  filter.ondata = (event) => {
    try {
      filter.write(event.data);
    } catch {
      streamWriteFailed = true;
      disconnectFilter(filter);
      return;
    }
    if (!streamWriteFailed) capture.retain(event.data);
  };

  filter.onerror = () => {
    streamWriteFailed = true;
    disconnectFilter(filter);
  };

  filter.onstop = () => {
    const completedAt = dependencies.now();
    if (streamWriteFailed) {
      disconnectFilter(filter);
      return;
    }
    closeFilter(filter);
    const frameUrl = details.documentUrl ?? details.originUrl ?? details.initiator ?? details.url;
    const cssText = capture.decodeRetainedText();
    const summaries: AnalysisSummary[] = [];

    if (cssText.trim()) {
      try {
        summaries.push(dependencies.analyze({
          cssText,
          pageUrl: frameUrl,
          frameUrl,
          sourceKind: "stylesheet",
          sourceUrl: details.url,
        }));
      } catch {
        summaries.push(createPerformanceBudgetSummary(frameUrl, frameUrl, details.url, "Firefox enhanced stylesheet response analysis failed after the response was safely passed through.", completedAt));
      }
    }

    if (capture.truncated) {
      summaries.push(createPerformanceBudgetSummary(frameUrl, frameUrl, details.url, `Firefox enhanced stylesheet response inspection retained ${capture.retainedBytes} byte(s) and stopped retaining additional bytes at the configured response budget.`, completedAt));
    }

    if (summaries.length === 0) return;
    const summary = mergeSummaries(summaries, completedAt);
    if (summary.findings.length === 0 && summary.partialStylesheets === 0) return;

    void dependencies.saveFrameReport(details.tabId as number, frameUrl, {
      frameId: typeof details.frameId === "number" ? details.frameId : 0,
      parentFrameId: typeof details.parentFrameId === "number" ? details.parentFrameId : -1,
      frameUrl,
      frameOrigin: getOrigin(frameUrl),
      summary,
      updatedAt: completedAt,
    });
  };

  return true;
}

interface BoundedResponseCapture {
  readonly retainedBytes: number;
  readonly truncated: boolean;
  retain(data: ArrayBuffer): void;
  decodeRetainedText(): string;
}

function closeFilter(filter: FilterResponseData): void {
  try { filter.close(); } catch { disconnectFilter(filter); }
}

function disconnectFilter(filter: FilterResponseData): void {
  try { filter.disconnect?.(); } catch {}
}

function createBoundedResponseCapture(maxRetainedBytes: number): BoundedResponseCapture {
  const chunks: ArrayBuffer[] = [];
  const byteLimit = Math.max(0, Math.trunc(maxRetainedBytes));
  let retainedBytes = 0;
  let truncated = false;

  return {
    get retainedBytes() { return retainedBytes; },
    get truncated() { return truncated; },
    retain(data: ArrayBuffer): void {
      if (retainedBytes >= byteLimit) {
        truncated = true;
        return;
      }
      const remaining = byteLimit - retainedBytes;
      if (data.byteLength <= remaining) {
        chunks.push(data.slice(0));
        retainedBytes += data.byteLength;
        return;
      }
      chunks.push(data.slice(0, remaining));
      retainedBytes += remaining;
      truncated = true;
    },
    decodeRetainedText(): string {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      return chunks.map((chunk, index) => decoder.decode(chunk, { stream: index < chunks.length - 1 })).join("") + decoder.decode();
    },
  };
}
