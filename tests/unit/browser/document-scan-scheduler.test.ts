import { describe, expect, it, vi } from "vitest";
import { createDebouncedScanScheduler, shouldScheduleRescanForMutations } from "../../../src/browser/scanner/documentScanScheduler";

function nodeListFixture(nodes: readonly Node[]): NodeList {
  return nodes as unknown as NodeList;
}

function mutationRecordFixture(overrides: Partial<MutationRecord> & Pick<MutationRecord, "type" | "target">): MutationRecord {
  const emptyNodes = nodeListFixture([]);
  return {
    addedNodes: emptyNodes,
    attributeName: null,
    attributeNamespace: null,
    nextSibling: null,
    oldValue: null,
    previousSibling: null,
    removedNodes: emptyNodes,
    ...overrides,
  };
}

function childListMutation(node: Node): MutationRecord {
  return mutationRecordFixture({
    type: "childList",
    target: document,
    addedNodes: nodeListFixture([node]),
  });
}

function attributeMutation(target: Node): MutationRecord {
  return mutationRecordFixture({ type: "attributes", target });
}

describe("document scan scheduler", () => {
  it("debounces repeated mutation-triggered scans and can flush immediately", () => {
    vi.useFakeTimers();
    try {
      const runScan = vi.fn();
      const scheduler = createDebouncedScanScheduler({ runScan, debounceMs: 25 });

      scheduler.schedule();
      scheduler.schedule();
      vi.advanceTimersByTime(24);
      expect(runScan).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(runScan).toHaveBeenCalledTimes(1);

      scheduler.schedule();
      scheduler.flush();
      expect(runScan).toHaveBeenCalledTimes(2);
      vi.runOnlyPendingTimers();
      expect(runScan).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a pending scan without firing it", () => {
    vi.useFakeTimers();
    try {
      const runScan = vi.fn();
      const scheduler = createDebouncedScanScheduler({ runScan, debounceMs: 25 });
      scheduler.schedule();
      scheduler.cancel();
      vi.runOnlyPendingTimers();
      expect(runScan).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("detects rescan-relevant attribute and added subtree mutations", () => {
    const style = document.createElement("style");
    expect(shouldScheduleRescanForMutations([childListMutation(style)])).toBe(true);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = '<iframe src="https://third.example/frame"></iframe>';
    expect(shouldScheduleRescanForMutations([childListMutation(wrapper)])).toBe(true);

    const inert = document.createElement("span");
    expect(shouldScheduleRescanForMutations([childListMutation(inert)])).toBe(false);
    expect(shouldScheduleRescanForMutations([attributeMutation(inert)])).toBe(true);
  });


  it("detects stylesheet text mutations after a style element already exists", () => {
    const style = document.createElement("style");
    const text = document.createTextNode('#css-sentry-fixtures input[value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { background-image: url("/api/hit/known-detector-smoke.svg?session=00000000-0000-4000-8000-000000000000"); }');
    style.append(text);

    const addedStyleText = mutationRecordFixture({
      type: "childList",
      target: style,
      addedNodes: nodeListFixture([text]),
    });
    const changedStyleText = mutationRecordFixture({ type: "characterData", target: text });

    expect(shouldScheduleRescanForMutations([addedStyleText])).toBe(true);
    expect(shouldScheduleRescanForMutations([changedStyleText])).toBe(true);
  });

  it("coalesces mutation storms into one scheduled scan decision", () => {
    const inert = document.createElement("span");
    const mutations = Array.from({ length: 5 }, () => childListMutation(inert));
    expect(shouldScheduleRescanForMutations(mutations, { maxObservedMutationsPerBatch: 4 })).toBe(true);
  });
});
