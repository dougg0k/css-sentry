import { browser } from "wxt/browser";
import { STORAGE_KEYS } from "../../shared/constants";
import type { DnrStatus, Finding, SitePolicy } from "../../shared/types";
import { getOrigin } from "../../shared/url";

const DNR_BASE_RULE_ID = 700_000;
const STRICT_RULE_ID = 790_000;
const SVG_IMAGE_RULE_ID = 795_000;
const POLICY_BASE_RULE_ID = 800_000;
const GLOBAL_POLICY_BASE_RULE_ID = 900_000;
const MAX_DYNAMIC_RULES_PER_SCAN = 50;
const MAX_POLICY_RULES_PER_TAB = 80;
const MAX_GLOBAL_POLICY_RULES = 120;
const RULES_PER_TAB = 100;
const POLICY_RULES_PER_TAB = 100;
const TAB_RULE_BUCKETS = 500;
const DNR_RESOURCE_TYPES = ["image", "stylesheet", "font", "media", "object", "other"] as const;
const STRICT_RESOURCE_TYPES = ["stylesheet", "image", "font"] as const;
const SVG_IMAGE_RESOURCE_TYPES = ["image", "object", "other"] as const;

type DnrResourceType = (typeof DNR_RESOURCE_TYPES)[number];
type DnrRuleActionType = "allow" | "block";
type DnrScope = DnrStatus["scope"];

export interface DnrBlockResult {
  blockedUrls: string[];
  blockedFindings: Set<string>;
  skippedAllowedUrls: string[];
  strictThirdPartyRule: boolean;
  policyRuleCount: number;
  ok: boolean;
  message: string;
}

interface DestinationPolicyDecision {
  action: "allow" | "block" | "neutral";
  origin: string | null;
}

interface RuleInput {
  id: number;
  priority: number;
  action: DnrRuleActionType;
  requestDomains?: string[];
  urlFilter?: string;
  regexFilter?: string;
  tabId?: number;
  resourceTypes: readonly DnrResourceType[];
  domainType?: "thirdParty";
}

export async function blockHighConfidenceFindingUrls(findings: Finding[], tabId: number, policy?: SitePolicy): Promise<DnrBlockResult> {
  if (!hasDnrSupport()) return unsupportedResult("finding");

  const blockedFindings = new Set<string>();
  const blockedUrls: string[] = [];
  const skippedAllowedUrls: string[] = [];
  const rules: ReturnType<typeof toDnrRule>[] = [];

  const candidates = findings
    .filter((finding) => (finding.severity === "high" || finding.severity === "critical") && Boolean(finding.destinationUrl) && isBalancedDnrBlockCandidate(finding))
    .sort(compareDnrCandidatePriority);

  for (const finding of candidates) {
    if (rules.length >= MAX_DYNAMIC_RULES_PER_SCAN) break;
    const destinationUrl = finding.destinationUrl as string;
    const decision = policy ? destinationPolicyForUrl(destinationUrl, policy) : { action: "neutral" as const, origin: getOrigin(destinationUrl) };
    if (decision.action === "allow") {
      skippedAllowedUrls.push(destinationUrl);
      continue;
    }

    const destination = parseUrl(destinationUrl);
    const id = tabRuleId(tabId, rules.length);
    rules.push(toDnrRule({
      id,
      priority: decision.action === "block" ? 6 : 2,
      action: "block",
      requestDomains: destination ? [destination.hostname] : undefined,
      urlFilter: destination ? undefined : destinationUrl,
      tabId,
      resourceTypes: DNR_RESOURCE_TYPES
    }));
    blockedFindings.add(finding.id);
    blockedUrls.push(destinationUrl);
  }

  try {
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: tabRuleIds(tabId), addRules: rules });
    await recordDnrStatus("finding", true, `Installed ${rules.length} finding-based DNR rule(s) for tab ${tabId}.`, rules.length);
    return { blockedUrls, blockedFindings, skippedAllowedUrls, strictThirdPartyRule: false, policyRuleCount: 0, ok: true, message: "finding rules applied" };
  } catch (error) {
    const message = errorMessage(error);
    await recordDnrStatus("finding", false, message, rules.length);
    return emptyResult(false, message);
  }
}

export async function applyGlobalPolicyDnrRules(policy: SitePolicy): Promise<DnrBlockResult> {
  if (!hasDnrSupport()) return unsupportedResult("global");

  const addRules = buildPolicyRules(policy, undefined, GLOBAL_POLICY_BASE_RULE_ID, MAX_GLOBAL_POLICY_RULES);
  try {
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: globalPolicyRuleIds(), addRules });
    await recordDnrStatus("global", true, `Installed ${addRules.length} global destination policy DNR rule(s).`, addRules.length);
    return {
      blockedUrls: originsToRuleTargets(policy.blocklistedOrigins).map((target) => target.origin),
      blockedFindings: new Set(),
      skippedAllowedUrls: originsToRuleTargets(policy.allowlistedOrigins).map((target) => target.origin),
      strictThirdPartyRule: false,
      policyRuleCount: addRules.length,
      ok: true,
      message: "global policy rules applied",
    };
  } catch (error) {
    const message = errorMessage(error);
    await recordDnrStatus("global", false, message, addRules.length);
    return emptyResult(false, message);
  }
}

export async function applyTabPolicyDnrRules(tabId: number, topLevelUrl: string, policy: SitePolicy, strictEnabled: boolean): Promise<DnrBlockResult> {
  if (!hasDnrSupport()) return unsupportedResult("tab");

  const removeRuleIds = [...policyRuleIds(tabId), strictRuleId(tabId), svgImageRuleId(tabId)];
  const addRules = buildPolicyRules(policy, tabId, policyRuleBase(tabId), MAX_POLICY_RULES_PER_TAB);
  const allowlistedTargets = originsToRuleTargets(policy.allowlistedOrigins).slice(0, MAX_POLICY_RULES_PER_TAB / 2);
  const blocklistedTargets = originsToRuleTargets(policy.blocklistedOrigins).slice(0, MAX_POLICY_RULES_PER_TAB / 2);

  if (strictEnabled && policy.compatibility.enableStrictThirdPartyBlocking) {
    addRules.push(toDnrRule({
      id: strictRuleId(tabId),
      priority: 1,
      action: "block",
      tabId,
      resourceTypes: STRICT_RESOURCE_TYPES,
      domainType: "thirdParty"
    }));
  }

  if (strictEnabled && policy.compatibility.enableSvgImageDnrPolicy) {
    addRules.push(toDnrRule({
      id: svgImageRuleId(tabId),
      priority: 3,
      action: "block",
      tabId,
      resourceTypes: SVG_IMAGE_RESOURCE_TYPES,
      domainType: "thirdParty",
      regexFilter: "^https?://[^?#]+\\.svg(?:[?#].*)?$"
    }));
  }

  try {
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds, addRules });
    await recordDnrStatus("tab", true, addRules.length === 0 ? `Network rules active; no tab-specific rules needed for tab ${tabId}.` : `Network rules active; installed ${addRules.length} tab-scoped DNR rule(s) for tab ${tabId}.`, addRules.length);
    return {
      blockedUrls: blocklistedTargets.map((target) => target.origin),
      blockedFindings: new Set(),
      skippedAllowedUrls: allowlistedTargets.map((target) => target.origin),
      strictThirdPartyRule: strictEnabled && (policy.compatibility.enableStrictThirdPartyBlocking || policy.compatibility.enableSvgImageDnrPolicy),
      policyRuleCount: addRules.length,
      ok: true,
      message: "tab policy rules applied",
    };
  } catch (error) {
    const message = errorMessage(error);
    await recordDnrStatus("tab", false, message, addRules.length);
    return emptyResult(false, message);
  }
}

export async function setStrictThirdPartyRule(tabId: number, enabled: boolean, policy: SitePolicy, topLevelUrl = ""): Promise<boolean> {
  const result = await applyTabPolicyDnrRules(tabId, topLevelUrl, policy, enabled);
  return result.strictThirdPartyRule;
}

export async function clearTabDnrRules(tabId: number): Promise<void> {
  if (!hasDnrSupport()) return;
  try {
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [...tabRuleIds(tabId), ...policyRuleIds(tabId), strictRuleId(tabId), svgImageRuleId(tabId)] });
    await recordDnrStatus("clear", true, `Cleared DNR rules for tab ${tabId}.`, 0);
  } catch (error) {
    await recordDnrStatus("clear", false, errorMessage(error), 0);
  }
}

export async function clearGlobalPolicyDnrRules(): Promise<void> {
  if (!hasDnrSupport()) return;
  try {
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: globalPolicyRuleIds() });
    await recordDnrStatus("global", true, "Cleared global destination policy DNR rules.", 0);
  } catch (error) {
    await recordDnrStatus("global", false, errorMessage(error), 0);
  }
}

export async function getDnrStatus(): Promise<DnrStatus | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.dnrStatus);
  return (stored[STORAGE_KEYS.dnrStatus] as DnrStatus | undefined) ?? null;
}

export function destinationPolicyForUrl(url: string, policy: SitePolicy): DestinationPolicyDecision {
  const origin = getOrigin(url);
  if (!origin) return { action: "neutral", origin: null };
  if (policy.blocklistedOrigins.includes(origin)) return { action: "block", origin };
  if (policy.allowlistedOrigins.includes(origin)) return { action: "allow", origin };
  return { action: "neutral", origin };
}

function buildPolicyRules(policy: SitePolicy, tabId: number | undefined, baseRuleId: number, maxRules: number): ReturnType<typeof toDnrRule>[] {
  const addRules: ReturnType<typeof toDnrRule>[] = [];
  const blocklistedTargets = originsToRuleTargets(policy.blocklistedOrigins).slice(0, maxRules / 2);
  const allowlistedTargets = originsToRuleTargets(policy.allowlistedOrigins).slice(0, maxRules / 2);

  let offset = 0;
  for (const target of blocklistedTargets) {
    addRules.push(toDnrRule({
      id: baseRuleId + offset++,
      priority: 6,
      action: "block",
      regexFilter: target.regexFilter,
      tabId,
      resourceTypes: DNR_RESOURCE_TYPES
    }));
  }

  for (const target of allowlistedTargets) {
    addRules.push(toDnrRule({
      id: baseRuleId + offset++,
      priority: 5,
      action: "allow",
      regexFilter: target.regexFilter,
      tabId,
      resourceTypes: DNR_RESOURCE_TYPES
    }));
  }

  return addRules;
}


const DNR_SEVERITY_PRIORITY = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

function compareDnrCandidatePriority(left: Finding, right: Finding): number {
  const severityDelta = DNR_SEVERITY_PRIORITY[right.severity] - DNR_SEVERITY_PRIORITY[left.severity];
  if (severityDelta !== 0) return severityDelta;
  const localNetworkDelta = Number(right.reasons.includes("url.local_network")) - Number(left.reasons.includes("url.local_network"));
  if (localNetworkDelta !== 0) return localNetworkDelta;
  const importDelta = Number(right.reasons.includes("sink.import_remote")) - Number(left.reasons.includes("sink.import_remote"));
  if (importDelta !== 0) return importDelta;
  const selectorDelta = Number(hasSensitiveSelectorReason(right)) - Number(hasSensitiveSelectorReason(left));
  if (selectorDelta !== 0) return selectorDelta;
  return right.confidence - left.confidence;
}

function isBalancedDnrBlockCandidate(finding: Finding): boolean {
  if (finding.reasons.includes("sink.font_remote") && !hasSensitiveSelectorReason(finding)) return false;
  if (!hasSinkReason(finding) && !finding.reasons.includes("url.local_network")) return false;
  return true;
}

function hasSensitiveSelectorReason(finding: Finding): boolean {
  return finding.reasons.some((reason) => reason.startsWith("selector.attribute") || reason === "selector.hidden_input" || reason === "selector.form_control");
}

function hasSinkReason(finding: Finding): boolean {
  return finding.reasons.some((reason) => reason.startsWith("sink.") || reason === "sink.import_remote");
}

function emptyResult(ok = true, message = "no DNR rules applied"): DnrBlockResult {
  return { blockedUrls: [], blockedFindings: new Set(), skippedAllowedUrls: [], strictThirdPartyRule: false, policyRuleCount: 0, ok, message };
}

function unsupportedResult(scope: DnrScope): DnrBlockResult {
  void recordDnrStatus("unsupported", false, "declarativeNetRequest.updateSessionRules is unavailable.", 0);
  return emptyResult(false, "DNR is unavailable");
}

async function recordDnrStatus(scope: DnrScope, ok: boolean, message: string, ruleCount: number): Promise<void> {
  const status: DnrStatus = {
    ok,
    operation: scope,
    scope,
    ruleCount,
    message,
    updatedAt: Date.now(),
  };
  try {
    await browser.storage.local.set({ [STORAGE_KEYS.dnrStatus]: status });
  } catch {
    // DNR status is diagnostic-only; protection behavior must not depend on status storage.
  }
}

function hasDnrSupport(): boolean { return typeof browser.declarativeNetRequest?.updateSessionRules === "function"; }
function strictRuleId(tabId: number): number { return STRICT_RULE_ID + (Math.abs(tabId) % TAB_RULE_BUCKETS); }
function svgImageRuleId(tabId: number): number { return SVG_IMAGE_RULE_ID + (Math.abs(tabId) % TAB_RULE_BUCKETS); }
function tabRuleBase(tabId: number): number { return DNR_BASE_RULE_ID + (Math.abs(tabId) % TAB_RULE_BUCKETS) * RULES_PER_TAB; }
function tabRuleId(tabId: number, index: number): number { return tabRuleBase(tabId) + index; }
function tabRuleIds(tabId: number): number[] { return Array.from({ length: MAX_DYNAMIC_RULES_PER_SCAN }, (_value, index) => tabRuleId(tabId, index)); }
function policyRuleBase(tabId: number): number { return POLICY_BASE_RULE_ID + (Math.abs(tabId) % TAB_RULE_BUCKETS) * POLICY_RULES_PER_TAB; }
function policyRuleId(tabId: number, index: number): number { return policyRuleBase(tabId) + index; }
function policyRuleIds(tabId: number): number[] { return Array.from({ length: MAX_POLICY_RULES_PER_TAB }, (_value, index) => policyRuleId(tabId, index)); }
function globalPolicyRuleIds(): number[] { return Array.from({ length: MAX_GLOBAL_POLICY_RULES }, (_value, index) => GLOBAL_POLICY_BASE_RULE_ID + index); }
function parseUrl(value: string): URL | null { try { return new URL(value); } catch { return null; } }

interface PolicyRuleTarget {
  origin: string;
  hostname: string;
  urlFilter: string;
  regexFilter: string;
}

function originsToRuleTargets(origins: string[]): PolicyRuleTarget[] {
  const targets = origins
    .map((origin) => parseUrl(origin))
    .filter((url): url is URL => Boolean(url))
    .map((url) => {
      const origin = url.origin;
      return { origin, hostname: url.hostname, urlFilter: `|${origin}/`, regexFilter: `^${escapeRegex(origin)}/` };
    });

  return [...new Map(targets.map((target) => [target.origin, target])).values()]
    .sort((a, b) => a.origin.localeCompare(b.origin));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDnrRule(input: RuleInput) {
  const condition: Record<string, unknown> = {
    resourceTypes: [...input.resourceTypes],
  };
  if (typeof input.tabId === "number") condition.tabIds = [input.tabId];
  if (input.requestDomains?.length) condition.requestDomains = input.requestDomains;
  if (input.urlFilter) condition.urlFilter = input.urlFilter;
  if (input.regexFilter) condition.regexFilter = input.regexFilter;
  if (input.domainType) condition.domainType = input.domainType;

  return {
    id: input.id,
    priority: input.priority,
    action: { type: input.action },
    condition,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "DNR rule update failed.";
}
