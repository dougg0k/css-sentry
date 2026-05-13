import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_POLICY, EMPTY_ANALYSIS_SUMMARY } from "../../../src/shared/constants";
import { activeTabState, derivePopupViewState } from "../../../src/entrypoints/popup/popupDerivedState";
import type { Finding, StoredTabReport } from "../../../src/shared/types";

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: "finding-1",
    severity: "critical",
    confidence: 99,
    pageUrl: "https://app.example.test/",
    pageOrigin: "https://app.example.test",
    frameUrl: "https://app.example.test/",
    frameOrigin: "https://app.example.test",
    sourceKind: "style_element",
    sourceUrl: "https://app.example.test/",
    sourceOrigin: "https://app.example.test",
    selector: "input[value*=secret]",
    property: "background-image",
    destinationOrigin: "https://attacker.example",
    destinationUrl: "https://attacker.example/leak.png",
    action: "logged",
    state: "analysis.complete",
    reasons: ["selector.attribute.substring_match", "sink.remote_url", "url.cross_origin"],
    timestamp: 1,
    details: "test finding",
    ...overrides,
  };
}

function report(findings: Finding[]): StoredTabReport {
  return {
    tabId: 1,
    url: "https://app.example.test/",
    origin: "https://app.example.test",
    summary: { ...EMPTY_ANALYSIS_SUMMARY, findings, analyzedFrames: 1, startedAt: 1, finishedAt: 2 },
    frames: [],
    updatedAt: 2,
  };
}

describe("popup derived state", () => {
  it("uses waiting status without a report and sanitizes null-like active-tab origins", () => {
    const view = derivePopupViewState(null, DEFAULT_SITE_POLICY, activeTabState({ id: 1, url: "about:blank" }));
    expect(view.currentOrigin).toBeNull();
    expect(view.statusTitle).toBe("No page changes made");
    expect(view.statusDetail).toBe("Waiting for the first page scan");
  });

  it("separates installed DNR rules from already-prevented page changes", () => {
    const view = derivePopupViewState(report([finding({ action: "rule_installed_dnr" })]), DEFAULT_SITE_POLICY, null);
    expect(view.ruleInstalledFindings).toHaveLength(1);
    expect(view.pageChangedFindings).toHaveLength(0);
    expect(view.statusTitle).toBe("1 blocking rule active after analysis");
    expect(view.statusDetail).toContain("No request is counted as already prevented");
  });

  it("counts hidden partial-analysis findings according to the display policy", () => {
    const coverage = finding({
      id: "coverage-1",
      severity: "info",
      action: "logged",
      state: "stylesheet.cross_origin_uninspectable",
      reasons: ["stylesheet.cross_origin.uninspectable"],
      destinationOrigin: null,
      destinationUrl: null,
    });
    const hidden = derivePopupViewState(report([coverage]), DEFAULT_SITE_POLICY, null);
    expect(hidden.visibleFindings).toEqual([]);
    expect(hidden.hiddenPartialAnalysisFindings).toBe(1);

    const shownPolicy = { ...DEFAULT_SITE_POLICY, compatibility: { ...DEFAULT_SITE_POLICY.compatibility, showPartialAnalysisFindings: true } };
    const shown = derivePopupViewState(report([coverage]), shownPolicy, null);
    expect(shown.visibleFindings).toHaveLength(1);
    expect(shown.coverageFindings).toHaveLength(1);
  });
});
