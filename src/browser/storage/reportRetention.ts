import { browser } from "wxt/browser";
import { REPORT_LIMITS, STORAGE_KEYS } from "../../shared/constants";
import { systemNow } from "../../shared/clock";
import type { SitePolicy, StoredTabReport } from "../../shared/types";
import { getSitePolicy } from "./policyStore";

const DAY_MS = 86_400_000;

export type StoredReportEntry = readonly [key: string, report: StoredTabReport];

export async function enforceReportRetention(policy?: SitePolicy, now = systemNow()): Promise<void> {
  const effectivePolicy = policy ?? await getSitePolicy();
  const stored = await browser.storage.local.get(null);
  const reportEntries = Object.entries(stored)
    .filter((entry): entry is [string, StoredTabReport] => entry[0].startsWith(STORAGE_KEYS.reportsPrefix));
  const staleKeys = selectReportKeysForRemoval(reportEntries, effectivePolicy, now);

  if (staleKeys.length > 0) await browser.storage.local.remove(staleKeys);
}

export function selectReportKeysForRemoval(entries: readonly StoredReportEntry[], policy: Pick<SitePolicy, "logRetentionDays">, now = systemNow()): string[] {
  const retentionCutoff = now - policy.logRetentionDays * DAY_MS;
  const sortedEntries = [...entries].sort(compareReportEntriesByUpdatedAtDesc);
  const staleKeys = new Set<string>();

  for (const [key, report] of sortedEntries) {
    const updatedAt = report.updatedAt ?? 0;
    if (updatedAt < retentionCutoff) staleKeys.add(key);
  }

  for (const [key] of sortedEntries.slice(REPORT_LIMITS.maxReportsRetained)) staleKeys.add(key);
  return [...staleKeys];
}

function compareReportEntriesByUpdatedAtDesc(left: StoredReportEntry, right: StoredReportEntry): number {
  return (right[1].updatedAt ?? 0) - (left[1].updatedAt ?? 0);
}
