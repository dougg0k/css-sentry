import { describe, expect, it } from "vitest";
import { allocateRuleIds, createRuleIdAllocator, tabScopedRuleIds, tabScopedRuleIdsInRange, type SessionRuleLike } from "../../../src/browser/dnr/dnrRuleAllocation";

describe("DNR rule allocation", () => {
  it("allocates unused rule IDs while treating removed IDs as reusable", () => {
    const existingRules: SessionRuleLike[] = [
      { id: 700_000 },
      { id: 700_001 },
      { id: 700_003 },
      { id: 790_000 },
    ];

    expect(allocateRuleIds(existingRules, [700_001], 700_000, 700_005, 4)).toEqual([700_001, 700_002, 700_004]);
  });

  it("selects only tab-scoped rule IDs in the requested range", () => {
    const rules: SessionRuleLike[] = [
      { id: 700_001, condition: { tabIds: [3] } },
      { id: 700_002, condition: { tabIds: [4] } },
      { id: 800_001, condition: { tabIds: [3] } },
      { id: 900_001, condition: { tabIds: [3] } },
      { id: 700_003 },
    ];

    expect(tabScopedRuleIds(rules, 3)).toEqual([700_001, 800_001, 900_001]);
    expect(tabScopedRuleIdsInRange(rules, 3, 700_000, 790_000)).toEqual([700_001]);
  });

  it("provides typed sequential rule ID consumption without unsafe offset casts", () => {
    const allocator = createRuleIdAllocator([10, 11]);
    expect(allocator.remainingCount).toBe(2);
    expect(allocator.take()).toBe(10);
    expect(allocator.usedCount).toBe(1);
    expect(allocator.take()).toBe(11);
    expect(allocator.take()).toBeNull();
    expect(allocator.remainingCount).toBe(0);
  });
});
