import type { DnrScope } from "./dnrStatus";
import { recordDnrStatus } from "./dnrStatus";
import type { PreparedDnrRule } from "./dnrRuleBuilder";
import type { SessionRuleLike } from "./dnrRuleAllocation";
import { getSessionRules, hasDeclarativeNetRequestSessionRuleApi, updateSessionRules } from "../platform/dnrApi";

export interface RuleUpdateResult {
  installed: PreparedDnrRule[];
  failed: PreparedDnrRule[];
  batchError: string | null;
}

export function hasDnrSupport(): boolean {
  return hasDeclarativeNetRequestSessionRuleApi();
}

export async function getCurrentSessionRules(): Promise<SessionRuleLike[]> {
  return getSessionRules();
}

export async function removeSessionRules(removeRuleIds: readonly number[]): Promise<void> {
  if (removeRuleIds.length === 0) return;
  await updateSessionRules({ removeRuleIds: [...removeRuleIds] });
}

export async function applySessionRuleUpdate(removeRuleIds: readonly number[], addRules: readonly PreparedDnrRule[], scope: DnrScope): Promise<RuleUpdateResult> {
  const removeIds = [...removeRuleIds];
  const preparedRules = [...addRules];

  if (preparedRules.length === 0) {
    try {
      await removeSessionRules(removeIds);
      return { installed: [], failed: [], batchError: null };
    } catch (error) {
      return { installed: [], failed: [], batchError: errorMessage(error) };
    }
  }

  try {
    await updateSessionRules({ removeRuleIds: removeIds, addRules: preparedRules.map((item) => item.rule) });
    return { installed: preparedRules, failed: [], batchError: null };
  } catch (error) {
    const batchError = errorMessage(error);
    return salvageSessionRuleUpdate(removeIds, preparedRules, scope, batchError);
  }
}

async function salvageSessionRuleUpdate(removeRuleIds: readonly number[], addRules: readonly PreparedDnrRule[], scope: DnrScope, batchError: string): Promise<RuleUpdateResult> {
  const installed: PreparedDnrRule[] = [];
  const failed: PreparedDnrRule[] = [];

  try {
    await removeSessionRules(removeRuleIds);
  } catch {
    return { installed, failed: [...addRules], batchError };
  }

  for (const item of addRules) {
    try {
      await updateSessionRules({ addRules: [item.rule] });
      installed.push(item);
    } catch {
      failed.push(item);
    }
  }

  await recordDnrStatus(
    scope,
    failed.length === 0,
    failed.length === 0 ? `${scope} DNR rules recovered after batch failure.` : `${scope} DNR rules partially recovered after batch failure.`,
    installed.length,
  );

  return { installed, failed, batchError };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "DNR rule update failed.";
}
