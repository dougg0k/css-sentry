import { describe, expect, it, vi } from "vitest";
import { createDebouncedScanScheduler, shouldScheduleRescanForMutations } from "../../../src/browser/scanner/documentScanScheduler";

function childListMutation(node: Node): MutationRecord {
  return { type: "childList", addedNodes: [node] as unknown as NodeList, removedNodes: [] as unknown as NodeList } as MutationRecord;
}

function attributeMutation(target: Node): MutationRecord {
  return { type: "attributes", target, addedNodes: [] as unknown as NodeList, removedNodes: [] as unknown as NodeList } as MutationRecord;
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

  it("coalesces mutation storms into one scheduled scan decision", () => {
    const inert = document.createElement("span");
    const mutations = Array.from({ length: 5 }, () => childListMutation(inert));
    expect(shouldScheduleRescanForMutations(mutations, { maxObservedMutationsPerBatch: 4 })).toBe(true);
  });
});
