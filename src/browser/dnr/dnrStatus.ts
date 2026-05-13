import { browser } from "wxt/browser";
import { STORAGE_KEYS } from "../../shared/constants";
import type { Now } from "../../shared/clock";
import { systemNow } from "../../shared/clock";
import type { DnrStatus } from "../../shared/types";
import type { DnrSkippedTarget } from "./dnrTargetPreparation";

export type DnrScope = DnrStatus["scope"];

export async function getDnrStatus(): Promise<DnrStatus | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.dnrStatus);
  return (stored[STORAGE_KEYS.dnrStatus] as DnrStatus | undefined) ?? null;
}

export async function recordDnrStatus(scope: DnrScope, ok: boolean, message: string, ruleCount: number, skippedTargets: readonly DnrSkippedTarget[] = [], now: Now = systemNow): Promise<void> {
  const status: DnrStatus = { ok, operation: scope, scope, ruleCount, message, updatedAt: now() };
  if (skippedTargets.length > 0) {
    status.skippedTargetCount = skippedTargets.length;
    status.skippedTargetReasons = skippedTargetReasonCounts(skippedTargets);
  }

  try {
    await browser.storage.local.set({ [STORAGE_KEYS.dnrStatus]: status });
  } catch {
    // DNR status is diagnostic-only; protection behavior must not depend on status storage.
  }
}

export function skippedTargetReasonCounts(skippedTargets: readonly DnrSkippedTarget[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const target of skippedTargets) counts[target.reason] = (counts[target.reason] ?? 0) + 1;
  return counts;
}

export function formatSkippedTargetReasons(skippedTargets: readonly DnrSkippedTarget[]): string {
  return Object.entries(skippedTargetReasonCounts(skippedTargets))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
}
