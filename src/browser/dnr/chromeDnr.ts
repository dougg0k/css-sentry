import type { ExtensionMode, Finding, SitePolicy } from "../../shared/types";
import { getOrigin } from "../../shared/url";
import { allocateRuleIds, tabScopedRuleIds, tabScopedRuleIdsInRange } from "./dnrRuleAllocation";
import {
  DNR_RESOURCE_TYPES,
  FINDING_RULE_ID_MAX_EXCLUSIVE,
  FINDING_RULE_ID_MIN,
  MAX_DYNAMIC_RULES_PER_SCAN,
  MAX_POLICY_RULES_PER_TAB,
  TAB_POLICY_RULE_ID_MAX_EXCLUSIVE,
  TAB_POLICY_RULE_ID_MIN,
  buildGlobalPolicyRules,
  buildTabPolicyRules,
  globalPolicyRuleIds,
  toDnrRule,
  type PreparedDnrRule,
} from "./dnrRuleBuilder";
import { applySessionRuleUpdate, errorMessage, getCurrentSessionRules, hasDnrSupport, removeSessionRules } from "./dnrRuleUpdate";
import { formatSkippedTargetReasons, recordDnrStatus, type DnrScope } from "./dnrStatus";
import { initiatorDomainsForFinding, originsToRuleTargets, prepareRequestRuleTarget, type DnrSkippedTarget } from "./dnrTargetPreparation";
import { compareDnrCandidatePriority, findingDnrRequestUrl, isFindingDnrBlockCandidate, isSeverityEligibleForDnr } from "./findingDnrEligibility";

export type { DnrSkippedTarget, DnrSkippedTargetReason } from "./dnrTargetPreparation";
export { getDnrStatus } from "./dnrStatus";

export interface DnrBlockResult {
  blockedUrls: string[];
  blockedFindings: Set<string>;
  ruleInstalledUrls: string[];
  ruleInstalledFindings: Set<string>;
  skippedAllowedUrls: string[];
  skippedTargets: DnrSkippedTarget[];
  strictThirdPartyRule: boolean;
  policyRuleCount: number;
  ok: boolean;
  message: string;
}

interface DestinationPolicyDecision {
  action: "allow" | "block" | "neutral";
  origin: string | null;
}

export async function blockHighConfidenceFindingUrls(findings: Finding[], tabId: number, policy?: SitePolicy, mode: ExtensionMode = "balanced"): Promise<DnrBlockResult> {
  if (!hasDnrSupport()) return unsupportedResult("finding");

  const skippedAllowedUrls: string[] = [];
  const skippedTargets: DnrSkippedTarget[] = [];
  const candidates = findings
    .filter((finding) => findingDnrRequestUrl(finding) !== null && isSeverityEligibleForDnr(finding, mode))
    .sort(compareDnrCandidatePriority);

  const sessionRules = await getCurrentSessionRules();
  const removeRuleIds = tabScopedRuleIdsInRange(sessionRules, tabId, FINDING_RULE_ID_MIN, FINDING_RULE_ID_MAX_EXCLUSIVE);
  const ruleIds = allocateRuleIds(sessionRules, removeRuleIds, FINDING_RULE_ID_MIN, FINDING_RULE_ID_MAX_EXCLUSIVE, MAX_DYNAMIC_RULES_PER_SCAN);
  const rules = buildFindingRules({ candidates, tabId, policy, mode, ruleIds, skippedAllowedUrls, skippedTargets });

  const update = await applySessionRuleUpdate(removeRuleIds, rules, "finding");
  for (const item of update.failed) {
    if (item.finding) skippedTargets.push({ findingId: item.finding.id, url: item.targetUrl ?? null, reason: "rule_update_failed" });
  }

  const installedFindingSummary = summarizeInstalledFindingRules(update.installed);
  const ok = update.failed.length === 0 && update.batchError === null;
  const skippedMessage = skippedTargets.length > 0 ? `; skipped ${skippedTargets.length} DNR target(s): ${formatSkippedTargetReasons(skippedTargets)}` : "";
  const message = ok
    ? `finding rules applied for future requests${skippedMessage}`
    : `finding rules partially applied; ${update.failed.length} rule(s) failed${update.batchError ? ` after batch error: ${update.batchError}` : ""}${skippedMessage}`;

  await recordDnrStatus("finding", ok, message, update.installed.length, skippedTargets);
  return {
    ...installedFindingSummary,
    skippedAllowedUrls,
    skippedTargets,
    strictThirdPartyRule: false,
    policyRuleCount: 0,
    ok,
    message,
  };
}

export async function applyGlobalPolicyDnrRules(policy: SitePolicy): Promise<DnrBlockResult> {
  if (!hasDnrSupport()) return unsupportedResult("global");

  const addRules = buildGlobalPolicyRules(policy);
  const removeRuleIds = globalPolicyRuleIds();
  const update = await applySessionRuleUpdate(removeRuleIds, addRules, "global");
  const ok = update.failed.length === 0 && update.batchError === null;
  const message = ok ? "global policy rules applied" : `global policy rules partially applied; ${update.failed.length} rule(s) failed${update.batchError ? ` after batch error: ${update.batchError}` : ""}`;

  await recordDnrStatus("global", ok, message, update.installed.length);
  return {
    blockedUrls: originsToRuleTargets(policy.blocklistedOrigins).map((target) => target.origin),
    blockedFindings: new Set(),
    ruleInstalledUrls: [],
    ruleInstalledFindings: new Set(),
    skippedAllowedUrls: originsToRuleTargets(policy.allowlistedOrigins).map((target) => target.origin),
    skippedTargets: [],
    strictThirdPartyRule: false,
    policyRuleCount: update.installed.length,
    ok,
    message,
  };
}

export async function applyTabPolicyDnrRules(tabId: number, topLevelUrl: string, policy: SitePolicy, strictEnabled: boolean): Promise<DnrBlockResult> {
  if (!hasDnrSupport()) return unsupportedResult("tab");

  const sessionRules = await getCurrentSessionRules();
  const removeRuleIds = tabScopedRuleIdsInRange(sessionRules, tabId, TAB_POLICY_RULE_ID_MIN, TAB_POLICY_RULE_ID_MAX_EXCLUSIVE);
  const ruleIds = allocateRuleIds(sessionRules, removeRuleIds, TAB_POLICY_RULE_ID_MIN, TAB_POLICY_RULE_ID_MAX_EXCLUSIVE, MAX_POLICY_RULES_PER_TAB + 2);
  const addRules = buildTabPolicyRules(policy, tabId, ruleIds, strictEnabled);
  const allowlistedTargets = originsToRuleTargets(policy.allowlistedOrigins).slice(0, MAX_POLICY_RULES_PER_TAB / 2);
  const blocklistedTargets = originsToRuleTargets(policy.blocklistedOrigins).slice(0, MAX_POLICY_RULES_PER_TAB / 2);

  const update = await applySessionRuleUpdate(removeRuleIds, addRules, "tab");
  const ok = update.failed.length === 0 && update.batchError === null;
  const message = ok
    ? update.installed.length === 0 ? `Network rules active; no tab-specific rules needed for tab ${tabId}.` : `Network rules active; installed ${update.installed.length} tab-scoped DNR rule(s) for tab ${tabId}.`
    : `tab policy rules partially applied for tab ${tabId}; ${update.failed.length} rule(s) failed${update.batchError ? ` after batch error: ${update.batchError}` : ""}`;

  await recordDnrStatus("tab", ok, message, update.installed.length);
  return {
    blockedUrls: blocklistedTargets.map((target) => target.origin),
    blockedFindings: new Set(),
    ruleInstalledUrls: [],
    ruleInstalledFindings: new Set(),
    skippedAllowedUrls: allowlistedTargets.map((target) => target.origin),
    skippedTargets: [],
    strictThirdPartyRule: strictEnabled && (policy.compatibility.enableStrictThirdPartyBlocking || policy.compatibility.enableSvgImageDnrPolicy),
    policyRuleCount: update.installed.length,
    ok,
    message,
  };
}

export async function setStrictThirdPartyRule(tabId: number, enabled: boolean, policy: SitePolicy, topLevelUrl = ""): Promise<boolean> {
  const result = await applyTabPolicyDnrRules(tabId, topLevelUrl, policy, enabled);
  return result.strictThirdPartyRule;
}

export async function clearTabDnrRules(tabId: number): Promise<void> {
  if (!hasDnrSupport()) return;
  try {
    const removeRuleIds = tabScopedRuleIds(await getCurrentSessionRules(), tabId);
    await removeSessionRules(removeRuleIds);
    await recordDnrStatus("clear", true, `Cleared ${removeRuleIds.length} DNR rule(s) for tab ${tabId}.`, 0);
  } catch (error) {
    await recordDnrStatus("clear", false, errorMessage(error), 0);
  }
}

export async function clearGlobalPolicyDnrRules(): Promise<void> {
  if (!hasDnrSupport()) return;
  try {
    await removeSessionRules(globalPolicyRuleIds());
    await recordDnrStatus("global", true, "Cleared global destination policy DNR rules.", 0);
  } catch (error) {
    await recordDnrStatus("global", false, errorMessage(error), 0);
  }
}

export function destinationPolicyForUrl(url: string, policy: SitePolicy): DestinationPolicyDecision {
  const origin = getOrigin(url);
  if (!origin) return { action: "neutral", origin: null };
  if (policy.blocklistedOrigins.includes(origin)) return { action: "block", origin };
  if (policy.allowlistedOrigins.includes(origin)) return { action: "allow", origin };
  return { action: "neutral", origin };
}

function buildFindingRules(input: {
  candidates: readonly Finding[];
  tabId: number;
  policy: SitePolicy | undefined;
  mode: ExtensionMode;
  ruleIds: readonly number[];
  skippedAllowedUrls: string[];
  skippedTargets: DnrSkippedTarget[];
}): PreparedDnrRule[] {
  const rules: PreparedDnrRule[] = [];

  for (const finding of input.candidates) {
    if (rules.length >= MAX_DYNAMIC_RULES_PER_SCAN || rules.length >= input.ruleIds.length) break;

    const destinationUrl = findingDnrRequestUrl(finding);
    if (destinationUrl === null) continue;

    const decision = input.policy ? destinationPolicyForUrl(destinationUrl, input.policy) : { action: "neutral" as const, origin: getOrigin(destinationUrl) };
    if (decision.action === "allow") {
      input.skippedAllowedUrls.push(destinationUrl);
      continue;
    }
    if (decision.action !== "block" && !isFindingDnrBlockCandidate(finding, input.mode)) continue;

    const target = prepareRequestRuleTarget(destinationUrl);
    if (target.ok === false) {
      input.skippedTargets.push({ findingId: finding.id, url: target.url, reason: target.reason });
      continue;
    }

    const ruleId = input.ruleIds[rules.length];
    if (typeof ruleId !== "number") break;

    rules.push({
      kind: "finding",
      finding,
      targetUrl: target.target.requestUrl,
      policyAction: decision.action === "block" ? "block" : undefined,
      rule: toDnrRule({
        id: ruleId,
        priority: findingRulePriority(decision.action, input.mode),
        action: "block",
        regexFilter: target.target.regexFilter,
        tabId: input.tabId,
        initiatorDomains: initiatorDomainsForFinding(finding),
        resourceTypes: DNR_RESOURCE_TYPES,
      }),
    });
  }

  return rules;
}

function findingRulePriority(policyAction: DestinationPolicyDecision["action"], mode: ExtensionMode): number {
  if (policyAction === "block") return 6;
  return mode === "strict" ? 4 : 2;
}

function summarizeInstalledFindingRules(installedRules: readonly PreparedDnrRule[]): Pick<DnrBlockResult, "blockedUrls" | "blockedFindings" | "ruleInstalledUrls" | "ruleInstalledFindings"> {
  const blockedFindings = new Set<string>();
  const blockedUrls: string[] = [];
  const ruleInstalledFindings = new Set<string>();
  const ruleInstalledUrls: string[] = [];

  for (const item of installedRules) {
    if (!item.finding || !item.targetUrl) continue;
    if (item.policyAction === "block") {
      blockedFindings.add(item.finding.id);
      blockedUrls.push(item.targetUrl);
    } else {
      ruleInstalledFindings.add(item.finding.id);
      ruleInstalledUrls.push(item.targetUrl);
    }
  }

  return { blockedUrls, blockedFindings, ruleInstalledUrls, ruleInstalledFindings };
}

function emptyResult(ok = true, message = "no DNR rules applied"): DnrBlockResult {
  return { blockedUrls: [], blockedFindings: new Set(), ruleInstalledUrls: [], ruleInstalledFindings: new Set(), skippedAllowedUrls: [], skippedTargets: [], strictThirdPartyRule: false, policyRuleCount: 0, ok, message };
}

function unsupportedResult(scope: DnrScope): DnrBlockResult {
  void recordDnrStatus("unsupported", false, "declarativeNetRequest.updateSessionRules is unavailable.", 0);
  return emptyResult(false, `DNR is unavailable for ${scope}`);
}
