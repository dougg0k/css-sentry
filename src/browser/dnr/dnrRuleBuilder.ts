import type { Finding, SitePolicy } from "../../shared/types";
import { createRuleIdAllocator, type RuleIdAllocator } from "./dnrRuleAllocation";
import { originsToRuleTargets } from "./dnrTargetPreparation";

export const FINDING_RULE_ID_MIN = 700_000;
export const FINDING_RULE_ID_MAX_EXCLUSIVE = 790_000;
export const TAB_POLICY_RULE_ID_MIN = 790_000;
export const TAB_POLICY_RULE_ID_MAX_EXCLUSIVE = 900_000;
export const GLOBAL_POLICY_BASE_RULE_ID = 900_000;
export const MAX_DYNAMIC_RULES_PER_SCAN = 50;
export const MAX_POLICY_RULES_PER_TAB = 80;
export const MAX_GLOBAL_POLICY_RULES = 120;

export const DNR_RESOURCE_TYPES = ["image", "stylesheet", "font", "media", "object", "other"] as const;
export const STRICT_RESOURCE_TYPES = ["stylesheet", "image", "font"] as const;
export const SVG_IMAGE_RESOURCE_TYPES = ["image", "object", "other"] as const;

export type DnrResourceType = (typeof DNR_RESOURCE_TYPES)[number];
export type DnrRuleActionType = "allow" | "block";
export type PreparedRuleKind = "finding" | "policy";

export interface RuleInput {
  id: number;
  priority: number;
  action: DnrRuleActionType;
  requestDomains?: string[];
  initiatorDomains?: string[];
  urlFilter?: string;
  regexFilter?: string;
  tabId?: number;
  resourceTypes: readonly DnrResourceType[];
  domainType?: "thirdParty";
}

export type DnrRule = ReturnType<typeof toDnrRule>;

export interface PreparedDnrRule {
  kind: PreparedRuleKind;
  rule: DnrRule;
  targetUrl?: string;
  finding?: Finding;
  policyAction?: DnrRuleActionType;
}

export function globalPolicyRuleIds(): number[] {
  return Array.from({ length: MAX_GLOBAL_POLICY_RULES }, (_value, index) => GLOBAL_POLICY_BASE_RULE_ID + index);
}

export function buildGlobalPolicyRules(policy: SitePolicy): PreparedDnrRule[] {
  return buildPolicyRules(policy, undefined, globalPolicyRuleIds(), MAX_GLOBAL_POLICY_RULES);
}

export function buildTabPolicyRules(policy: SitePolicy, tabId: number, ids: readonly number[], strictEnabled: boolean): PreparedDnrRule[] {
  const allocator = createRuleIdAllocator(ids);
  const policyRules = buildPolicyRulesWithAllocator(policy, tabId, allocator, MAX_POLICY_RULES_PER_TAB);

  if (strictEnabled && policy.compatibility.enableStrictThirdPartyBlocking) {
    const id = allocator.take();
    if (id !== null) {
      policyRules.push({
        kind: "policy",
        rule: toDnrRule({
          id,
          priority: 1,
          action: "block",
          tabId,
          resourceTypes: STRICT_RESOURCE_TYPES,
          domainType: "thirdParty",
        }),
      });
    }
  }

  if (strictEnabled && policy.compatibility.enableSvgImageDnrPolicy) {
    const id = allocator.take();
    if (id !== null) {
      policyRules.push({
        kind: "policy",
        rule: toDnrRule({
          id,
          priority: 3,
          action: "block",
          tabId,
          resourceTypes: SVG_IMAGE_RESOURCE_TYPES,
          domainType: "thirdParty",
          regexFilter: "^https?://[^?#]+\\.svg(?:[?#].*)?$",
        }),
      });
    }
  }

  return policyRules;
}

export function buildPolicyRules(policy: SitePolicy, tabId: number | undefined, ids: readonly number[], maxRules: number): PreparedDnrRule[] {
  return buildPolicyRulesWithAllocator(policy, tabId, createRuleIdAllocator(ids), maxRules);
}

function buildPolicyRulesWithAllocator(policy: SitePolicy, tabId: number | undefined, allocator: RuleIdAllocator, maxRules: number): PreparedDnrRule[] {
  const addRules: PreparedDnrRule[] = [];
  const maxPerList = Math.floor(Math.min(maxRules, allocator.allocatedIds.length) / 2);
  const blocklistedTargets = originsToRuleTargets(policy.blocklistedOrigins).slice(0, maxPerList);
  const allowlistedTargets = originsToRuleTargets(policy.allowlistedOrigins).slice(0, maxPerList);

  for (const target of blocklistedTargets) {
    const id = allocator.take();
    if (id === null) break;
    addRules.push({
      kind: "policy",
      rule: toDnrRule({ id, priority: 6, action: "block", regexFilter: target.regexFilter, tabId, resourceTypes: DNR_RESOURCE_TYPES }),
    });
  }

  for (const target of allowlistedTargets) {
    const id = allocator.take();
    if (id === null) break;
    addRules.push({
      kind: "policy",
      rule: toDnrRule({ id, priority: 5, action: "allow", regexFilter: target.regexFilter, tabId, resourceTypes: DNR_RESOURCE_TYPES }),
    });
  }

  return addRules;
}

export function toDnrRule(input: RuleInput) {
  const condition: Record<string, unknown> = { resourceTypes: [...input.resourceTypes] };
  if (typeof input.tabId === "number") condition.tabIds = [input.tabId];
  if (input.requestDomains?.length) condition.requestDomains = input.requestDomains;
  if (input.initiatorDomains?.length) condition.initiatorDomains = input.initiatorDomains;
  if (input.urlFilter) condition.urlFilter = input.urlFilter;
  if (input.regexFilter) condition.regexFilter = input.regexFilter;
  if (input.domainType) condition.domainType = input.domainType;
  return { id: input.id, priority: input.priority, action: { type: input.action }, condition };
}
