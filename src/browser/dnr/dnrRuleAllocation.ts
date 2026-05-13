export interface SessionRuleLike {
  id?: number;
  condition?: {
    tabIds?: number[];
  };
}

export interface RuleIdAllocator {
  readonly allocatedIds: readonly number[];
  readonly usedCount: number;
  readonly remainingCount: number;
  take(): number | null;
}

export function tabScopedRuleIds(rules: readonly SessionRuleLike[], tabId: number): number[] {
  const ids: number[] = [];
  for (const rule of rules) {
    if (typeof rule.id !== "number" || !rule.condition?.tabIds?.includes(tabId)) continue;
    ids.push(rule.id);
  }
  return ids;
}

export function tabScopedRuleIdsInRange(rules: readonly SessionRuleLike[], tabId: number, min: number, maxExclusive: number): number[] {
  return tabScopedRuleIds(rules, tabId).filter((id) => id >= min && id < maxExclusive);
}

export function allocateRuleIds(sessionRules: readonly SessionRuleLike[], removedIds: readonly number[], min: number, maxExclusive: number, count: number): number[] {
  const removed = new Set(removedIds);
  const used = new Set<number>();
  for (const rule of sessionRules) {
    if (typeof rule.id !== "number" || removed.has(rule.id)) continue;
    used.add(rule.id);
  }

  const allocated: number[] = [];
  for (let id = min; id < maxExclusive && allocated.length < count; id += 1) {
    if (used.has(id)) continue;
    allocated.push(id);
  }
  return allocated;
}

export function createRuleIdAllocator(ids: readonly number[]): RuleIdAllocator {
  let offset = 0;
  return {
    get allocatedIds(): readonly number[] {
      return ids;
    },
    get usedCount(): number {
      return offset;
    },
    get remainingCount(): number {
      return Math.max(0, ids.length - offset);
    },
    take(): number | null {
      if (offset >= ids.length) return null;
      const id = ids[offset];
      offset += 1;
      return typeof id === "number" ? id : null;
    },
  };
}
