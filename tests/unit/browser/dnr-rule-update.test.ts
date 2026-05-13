import { describe, expect, it } from "vitest";
import { applySessionRuleUpdate } from "../../../src/browser/dnr/dnrRuleUpdate";
import { toDnrRule, type PreparedDnrRule } from "../../../src/browser/dnr/dnrRuleBuilder";
import { getMockSessionRules, regexFilter, setMockUpdateSessionRulesFailure } from "../../setup/dnr-test-helpers";

function preparedRule(id: number, filter: string): PreparedDnrRule {
  return {
    kind: "policy",
    rule: toDnrRule({ id, priority: 6, action: "block", regexFilter: filter, resourceTypes: ["image", "stylesheet", "font", "media", "object", "other"] }),
  };
}

describe("DNR rule update", () => {
  it("applies remove-only updates without treating empty add-rules as a failure", async () => {
    await applySessionRuleUpdate([], [preparedRule(700_001, "^https://old\\.example/")], "finding");
    expect(getMockSessionRules()).toHaveLength(1);

    const result = await applySessionRuleUpdate([700_001], [], "finding");
    expect(result).toEqual({ installed: [], failed: [], batchError: null });
    expect(getMockSessionRules()).toEqual([]);
  });

  it("salvages valid prepared rules after a batch update failure", async () => {
    const validRule = preparedRule(700_010, "^https://valid\\.example/");
    const rejectedRule = preparedRule(700_011, "^https://rejected\\.example/");
    setMockUpdateSessionRulesFailure((update) => Boolean(update.addRules?.some((rule) => regexFilter(rule)?.includes("rejected"))));

    const result = await applySessionRuleUpdate([], [validRule, rejectedRule], "finding");

    expect(result.installed).toEqual([validRule]);
    expect(result.failed).toEqual([rejectedRule]);
    expect(result.batchError).toBe("mock DNR rule update rejected");
    expect(getMockSessionRules().map((rule) => regexFilter(rule))).toEqual(["^https://valid\\.example/"]);
  });
});
