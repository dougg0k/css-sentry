import { describe, expect, it, vi } from "vitest";
import { EMPTY_ANALYSIS_SUMMARY, DEFAULT_SITE_POLICY } from "../../../src/shared/constants";
import { createDocumentScanController } from "../../../src/browser/scanner/documentScanController";
import type { AnalysisSummary } from "../../../src/shared/types";

function summary(state: AnalysisSummary["state"] = "analysis.complete"): AnalysisSummary {
  return { ...EMPTY_ANALYSIS_SUMMARY, state, startedAt: 1, finishedAt: 2 };
}

describe("document scan controller", () => {
  it("runs initial scans, applies neutralization, and sends the final summary", () => {
    const document = window.document;
    const scannedSummary = summary();
    const finalSummary = summary("analysis.partial");
    const scanDocument = vi.fn(() => scannedSummary);
    const applyContentNeutralization = vi.fn(() => ({ summary: finalSummary }));
    const sendScanComplete = vi.fn();
    const observer = { observe: vi.fn(), disconnect: vi.fn() };

    const controller = createDocumentScanController({
      document,
      windowTarget: window,
      policy: DEFAULT_SITE_POLICY,
      mode: "balanced",
      scanDocument,
      applyContentNeutralization,
      sendScanComplete,
      createMutationObserver: () => observer,
    });

    controller.start();

    expect(scanDocument).toHaveBeenCalledWith(document, DEFAULT_SITE_POLICY);
    expect(applyContentNeutralization).toHaveBeenCalledWith(document, scannedSummary, DEFAULT_SITE_POLICY, "balanced");
    expect(sendScanComplete).toHaveBeenCalledWith(finalSummary);
    expect(controller.getLastSummary()).toBe(finalSummary);
    expect(observer.observe).toHaveBeenCalledWith(document.documentElement, expect.objectContaining({ childList: true, subtree: true, attributes: true }));
  });

  it("schedules rescans for mutation batches and cancels owned lifecycle on dispose", () => {
    const scheduler = { schedule: vi.fn(), flush: vi.fn(), cancel: vi.fn() };
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    let mutationCallback: MutationCallback | null = null;

    const controller = createDocumentScanController({
      document: window.document,
      windowTarget: window,
      policy: DEFAULT_SITE_POLICY,
      mode: "balanced",
      scanDocument: () => summary(),
      applyContentNeutralization: (_document, nextSummary) => ({ summary: nextSummary }),
      sendScanComplete: () => undefined,
      createScanScheduler: () => scheduler,
      createMutationObserver(callback) {
        mutationCallback = callback;
        return observer;
      },
    });

    function triggerAttributeMutation(): void {
      if (!mutationCallback) throw new Error("Mutation observer callback was not registered.");
      mutationCallback([{ type: "attributes", addedNodes: [] } as unknown as MutationRecord], observer as unknown as MutationObserver);
    }

    controller.start();
    triggerAttributeMutation();
    expect(scheduler.schedule).toHaveBeenCalledTimes(1);

    controller.dispose();
    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);

    triggerAttributeMutation();
    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
  });

  it("publishes a bounded partial summary when scanning throws", () => {
    const document = window.document;
    const applyContentNeutralization = vi.fn((_document, nextSummary: AnalysisSummary) => ({ summary: nextSummary }));
    const sendScanComplete = vi.fn();
    const observer = { observe: vi.fn(), disconnect: vi.fn() };

    const controller = createDocumentScanController({
      document,
      windowTarget: window,
      policy: DEFAULT_SITE_POLICY,
      mode: "balanced",
      scanDocument: () => { throw new Error("scanner recursion guard fixture"); },
      applyContentNeutralization,
      sendScanComplete,
      createMutationObserver: () => observer,
    });

    expect(() => controller.start()).not.toThrow();
    const fallbackSummary = sendScanComplete.mock.calls[0][0] as AnalysisSummary;

    expect(fallbackSummary.state).toBe("analysis.skipped.performance_budget");
    expect(fallbackSummary.partialStylesheets).toBe(1);
    expect(fallbackSummary.findings[0]?.details).toContain("runtime error");
    expect(controller.getLastSummary()).toBe(fallbackSummary);
  });

});
