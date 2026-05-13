import { browser } from "wxt/browser";
import type { MockDnrRule, MockDnrSessionRuleUpdate } from "./browser-mock";

type DnrMockApi = typeof browser.declarativeNetRequest & {
  __getSessionRules(): MockDnrRule[];
  __setUpdateSessionRulesFailure(predicate: ((update: MockDnrSessionRuleUpdate) => boolean) | null): void;
};

export type { MockDnrRule, MockDnrSessionRuleUpdate };

function dnrMockApi(): DnrMockApi {
  return browser.declarativeNetRequest as DnrMockApi;
}

export function getMockSessionRules(): MockDnrRule[] {
  return dnrMockApi().__getSessionRules();
}

export function setMockUpdateSessionRulesFailure(predicate: ((update: MockDnrSessionRuleUpdate) => boolean) | null): void {
  dnrMockApi().__setUpdateSessionRulesFailure(predicate);
}

export function ruleAction(rule: MockDnrRule | undefined): string | undefined {
  return rule?.action?.type;
}

export function rulePriority(rule: MockDnrRule | undefined): number | undefined {
  return rule?.priority;
}

export function requestDomains(rule: MockDnrRule | undefined): string[] {
  return rule?.condition?.requestDomains ?? [];
}

export function urlFilter(rule: MockDnrRule | undefined): string | undefined {
  return rule?.condition?.urlFilter;
}

export function regexFilter(rule: MockDnrRule | undefined): string | undefined {
  return rule?.condition?.regexFilter;
}

export function domainType(rule: MockDnrRule | undefined): string | undefined {
  return rule?.condition?.domainType;
}

export function tabIds(rule: MockDnrRule | undefined): number[] | undefined {
  return rule?.condition?.tabIds;
}

export function resourceTypes(rule: MockDnrRule | undefined): string[] {
  return rule?.condition?.resourceTypes ?? [];
}

export function initiatorDomains(rule: MockDnrRule | undefined): string[] {
  return rule?.condition?.initiatorDomains ?? [];
}

export function ruleId(rule: MockDnrRule | undefined): number | undefined {
  return rule?.id;
}
