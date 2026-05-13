import { describe, expect, it } from "vitest";
import { browser } from "wxt/browser";
import { DEFAULT_SITE_POLICY, EMPTY_ANALYSIS_SUMMARY, REPORT_LIMITS, STORAGE_KEYS } from "../../../src/shared/constants";
import type { StoredTabReport } from "../../../src/shared/types";
import { enforceReportRetention, selectReportKeysForRemoval } from "../../../src/browser/storage/reportRetention";

const now = 1_700_000_000_000;

function report(tabId: number, updatedAt: number): StoredTabReport {
  return {
    tabId,
    url: `https://site-${tabId}.example/`,
    origin: `https://site-${tabId}.example`,
    summary: { ...EMPTY_ANALYSIS_SUMMARY },
    frames: [],
    updatedAt,
  };
}

describe("report retention", () => {
  it("selects stale reports and reports beyond the retention count cap", () => {
    const entries = Array.from({ length: REPORT_LIMITS.maxReportsRetained + 2 }, (_, index) => [
      `${STORAGE_KEYS.reportsPrefix}${index}`,
      report(index, now - index),
    ] as const);
    const staleKey = `${STORAGE_KEYS.reportsPrefix}stale`;
    const staleReport = report(999, now - 3 * 86_400_000);

    const selected = selectReportKeysForRemoval([[staleKey, staleReport], ...entries], { logRetentionDays: 1 }, now);

    expect(selected).toContain(staleKey);
    expect(selected).toContain(`${STORAGE_KEYS.reportsPrefix}${REPORT_LIMITS.maxReportsRetained}`);
    expect(selected).toContain(`${STORAGE_KEYS.reportsPrefix}${REPORT_LIMITS.maxReportsRetained + 1}`);
    expect(selected).not.toContain(`${STORAGE_KEYS.reportsPrefix}0`);
  });

  it("removes only retained-report keys from browser storage", async () => {
    await browser.storage.local.set({
      [STORAGE_KEYS.settings]: { ...DEFAULT_SITE_POLICY, logRetentionDays: 1 },
      [staleStorageKey(1)]: report(1, now - 2 * 86_400_000),
      [staleStorageKey(2)]: report(2, now),
      unrelated: { updatedAt: 0 },
    });

    await enforceReportRetention({ ...DEFAULT_SITE_POLICY, logRetentionDays: 1 }, now);

    const stored = await browser.storage.local.get(null);
    expect(stored[staleStorageKey(1)]).toBeUndefined();
    expect(stored[staleStorageKey(2)]).toBeDefined();
    expect(stored.unrelated).toBeDefined();
  });
});

function staleStorageKey(tabId: number): string {
  return `${STORAGE_KEYS.reportsPrefix}${tabId}`;
}
