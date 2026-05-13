import { ANALYSIS_LIMITS } from "../../shared/constants";

export const RESCAN_TRIGGER_SELECTOR = "style,link[rel~='stylesheet'],[style],body[background],feImage,animate,animateTransform,animateMotion,set,img[src],image[href],object[data],embed[src],iframe[src]";
export const RESCAN_ATTRIBUTE_FILTER = ["style", "background", "href", "src", "data", "xlink:href", "values", "from", "to", "by", "attributeName"] as const;

const ELEMENT_NODE_TYPE = 1;

type TimeoutHandle = number;

type SetTimer = (callback: () => void, delayMs: number) => TimeoutHandle;
type ClearTimer = (handle: TimeoutHandle) => void;

export interface ScanScheduler {
  schedule(): void;
  flush(): void;
  cancel(): void;
}

export interface ScanSchedulerOptions {
  runScan: () => void;
  debounceMs?: number;
  setTimer?: SetTimer;
  clearTimer?: ClearTimer;
}

export function createDebouncedScanScheduler(options: ScanSchedulerOptions): ScanScheduler {
  const debounceMs = options.debounceMs ?? ANALYSIS_LIMITS.mutationDebounceMs;
  const setTimer = options.setTimer ?? ((callback, delayMs) => window.setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((handle) => window.clearTimeout(handle));
  let pendingTimer: TimeoutHandle | null = null;

  function cancel(): void {
    if (pendingTimer === null) return;
    clearTimer(pendingTimer);
    pendingTimer = null;
  }

  function flush(): void {
    cancel();
    options.runScan();
  }

  function schedule(): void {
    cancel();
    pendingTimer = setTimer(() => {
      pendingTimer = null;
      options.runScan();
    }, debounceMs);
  }

  return { schedule, flush, cancel };
}

export function shouldScheduleRescanForMutations(
  mutations: readonly MutationRecord[],
  options: { maxObservedMutationsPerBatch?: number; triggerSelector?: string } = {},
): boolean {
  const maxObservedMutationsPerBatch = options.maxObservedMutationsPerBatch ?? ANALYSIS_LIMITS.maxObservedMutationsPerBatch;
  const triggerSelector = options.triggerSelector ?? RESCAN_TRIGGER_SELECTOR;

  if (mutations.length > maxObservedMutationsPerBatch) return true;

  for (const mutation of mutations) {
    if (mutation.type === "attributes") return true;
    for (const node of Array.from(mutation.addedNodes)) {
      if (node.nodeType !== ELEMENT_NODE_TYPE) continue;
      const element = node as Element;
      if (element.matches(triggerSelector) || element.querySelector(triggerSelector)) return true;
    }
  }

  return false;
}
