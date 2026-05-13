import { RESCAN_ATTRIBUTE_FILTER, createDebouncedScanScheduler, shouldScheduleRescanForMutations, type ScanScheduler } from "./documentScanScheduler";
import type { AnalysisSummary, ExtensionMode, SitePolicy } from "../../shared/types";

type ContentNeutralizationResult = { summary: AnalysisSummary };
type ListenerOptions = AddEventListenerOptions | boolean;
type ScanSchedulerFactory = (options: { runScan: () => void }) => ScanScheduler;
type MutationObserverLike = Pick<MutationObserver, "observe" | "disconnect">;
type MutationObserverFactory = (callback: MutationCallback) => MutationObserverLike;
type EventTargetLike = {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: ListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: ListenerOptions): void;
};

export interface DocumentScanControllerOptions {
  document: Document;
  windowTarget: EventTargetLike;
  policy: SitePolicy;
  mode: ExtensionMode;
  scanDocument: (document: Document, policy: SitePolicy) => AnalysisSummary;
  applyContentNeutralization: (document: Document, summary: AnalysisSummary, policy: SitePolicy, mode: ExtensionMode) => ContentNeutralizationResult;
  sendScanComplete: (summary: AnalysisSummary) => void | Promise<void>;
  createScanScheduler?: ScanSchedulerFactory;
  createMutationObserver?: MutationObserverFactory;
}

export interface DocumentScanController {
  start(): void;
  scanNow(): AnalysisSummary | null;
  dispose(): void;
  getLastSummary(): AnalysisSummary | null;
}

export function createDocumentScanController(options: DocumentScanControllerOptions): DocumentScanController {
  const schedulerFactory = options.createScanScheduler ?? createDebouncedScanScheduler;
  const observerFactory = options.createMutationObserver ?? ((callback) => new MutationObserver(callback));
  const scheduler = schedulerFactory({ runScan: () => { scanNow(); } });
  let observer: MutationObserverLike | null = null;
  let started = false;
  let disposed = false;
  let lastSummary: AnalysisSummary | null = null;

  function scanNow(): AnalysisSummary | null {
    if (disposed) return lastSummary;
    const scannedSummary = options.scanDocument(options.document, options.policy);
    lastSummary = options.applyContentNeutralization(options.document, scannedSummary, options.policy, options.mode).summary;
    void options.sendScanComplete(lastSummary);
    return lastSummary;
  }

  function onMutations(mutations: MutationRecord[]): void {
    if (!disposed && shouldScheduleRescanForMutations(mutations)) scheduler.schedule();
  }

  function start(): void {
    if (started || disposed) return;
    started = true;

    if (options.document.readyState === "loading") {
      scanNow();
      options.document.addEventListener("DOMContentLoaded", scanNow, { once: true });
      options.windowTarget.addEventListener("load", scanNow, { once: true });
    } else {
      scanNow();
      if (options.document.readyState !== "complete") options.windowTarget.addEventListener("load", scanNow, { once: true });
    }

    observer = observerFactory(onMutations);
    observer.observe(options.document.documentElement ?? options.document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...RESCAN_ATTRIBUTE_FILTER],
    });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    scheduler.cancel();
    observer?.disconnect();
    observer = null;
    options.document.removeEventListener("DOMContentLoaded", scanNow);
    options.windowTarget.removeEventListener("load", scanNow);
  }

  return {
    start,
    scanNow,
    dispose,
    getLastSummary: () => lastSummary,
  };
}
