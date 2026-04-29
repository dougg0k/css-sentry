import { describe, expect, it } from "vitest";
import { EMPTY_ANALYSIS_SUMMARY } from "../../../src/shared/constants";
import { validateRuntimeMessage } from "../../../src/browser/runtime/messageSecurity";

describe("runtime message security", () => {
  it("accepts scan-complete only from a tab-bound content script sender", () => {
    const message = { type: "css-sentry:scan-complete", url: "https://app.example/", summary: EMPTY_ANALYSIS_SUMMARY };
    expect(validateRuntimeMessage(message, { tab: { id: 1, url: "https://app.example/" }, frameId: 0 }).ok).toBe(true);
    expect(validateRuntimeMessage(message, { url: "chrome-extension://id/popup.html" }).ok).toBe(false);
  });

  it("rejects privileged policy messages from tab-bound content script senders", () => {
    const message = { type: "css-sentry:set-origin-mode", origin: "https://app.example", mode: "strict" };
    expect(validateRuntimeMessage(message, { tab: { id: 1, url: "https://app.example/" }, frameId: 0 }).ok).toBe(false);
    expect(validateRuntimeMessage(message, { url: "chrome-extension://id/options.html" }).ok).toBe(true);
  });

  it("rejects unknown css-sentry message types and oversized summaries", () => {
    expect(validateRuntimeMessage({ type: "css-sentry:unknown" }, { url: "chrome-extension://id/options.html" }).ok).toBe(false);
    const summary = { ...EMPTY_ANALYSIS_SUMMARY, findings: Array.from({ length: 2000 }, () => ({})) };
    expect(validateRuntimeMessage({ type: "css-sentry:scan-complete", url: "https://app.example/", summary }, { tab: { id: 1, url: "https://app.example/" }, frameId: 0 }).ok).toBe(false);
  });

  it("accepts clear-current-report only from extension pages with a valid tab id", () => {
    const message = { type: "css-sentry:clear-current-report", tabId: 7 };
    expect(validateRuntimeMessage(message, { url: "chrome-extension://id/popup.html" }).ok).toBe(true);
    expect(validateRuntimeMessage({ ...message, tabId: -1 }, { url: "chrome-extension://id/popup.html" }).ok).toBe(false);
    expect(validateRuntimeMessage({ ...message, tabId: "7" }, { url: "chrome-extension://id/popup.html" }).ok).toBe(false);
    expect(validateRuntimeMessage(message, { tab: { id: 1, url: "https://app.example/" }, frameId: 0 }).ok).toBe(false);
  });
});
