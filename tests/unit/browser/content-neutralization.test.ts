import { describe, expect, it } from "vitest";
import { analyzeStylesheet } from "../../../src/core/analyzer/analyzeStylesheet";
import { DEFAULT_SITE_POLICY, EMPTY_ANALYSIS_SUMMARY } from "../../../src/shared/constants";
import { applyContentNeutralization, neutralizationRuleForFinding } from "../../../src/browser/scanner/contentNeutralization";
import type { Finding } from "../../../src/shared/types";

describe("content-level neutralization", () => {
  it("injects precise override rules without a fixed page-visible marker and marks high-confidence CSS exfil findings as neutralized", () => {
    document.documentElement.innerHTML = "<head></head><body><input id='token' name='csrf_token' value='secret'><div id='sink'></div></body>";
    const summary = analyzeStylesheet({
      cssText: 'input[name="csrf_token"][value*="secret"]~#sink{background-image:url(https://app.example/src/pwned.png)}',
      pageUrl: "https://app.example/",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/style.css",
    });
    expect(summary.findings[0]?.action).toBe("logged");

    const result = applyContentNeutralization(document, summary, DEFAULT_SITE_POLICY, "balanced");
    const styles = [...document.querySelectorAll<HTMLStyleElement>("style")];
    const neutralizationStyle = styles.find((style) => style.textContent?.includes("background-image:none !important"));

    expect(result.ruleCount).toBe(1);
    expect(result.summary.findings[0]?.action).toBe("neutralized");
    expect(neutralizationStyle?.textContent).toContain('input[name="csrf_token"][value*="secret"]~#sink{background-image:none !important;}');
    expect(neutralizationStyle?.id).toBe("");
    expect(neutralizationStyle?.getAttribute("data-css-sentry")).toBeNull();
  });

  it("does not neutralize benign or low-confidence non-exfil findings", () => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    const result = applyContentNeutralization(document, EMPTY_ANALYSIS_SUMMARY, DEFAULT_SITE_POLICY, "balanced");
    expect(result.ruleCount).toBe(0);
    expect([...document.querySelectorAll("style")]).toHaveLength(0);
  });

  it("removes internally tracked neutralization rules when the compatibility option is disabled", () => {
    document.documentElement.innerHTML = "<head></head><body><input id='token' name='csrf_token' value='secret'><div id='sink'></div></body>";
    const summary = analyzeStylesheet({
      cssText: 'input[name="csrf_token"][value*="secret"]~#sink{background:url(https://app.example/src/pwned.png)}',
      pageUrl: "https://app.example/",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/style.css",
    });
    const enabledResult = applyContentNeutralization(document, summary, DEFAULT_SITE_POLICY, "balanced");
    expect(enabledResult.ruleCount).toBe(1);
    expect([...document.querySelectorAll("style")].some((style) => style.textContent?.includes("background:none !important"))).toBe(true);

    const policy = {
      ...DEFAULT_SITE_POLICY,
      compatibility: { ...DEFAULT_SITE_POLICY.compatibility, enableContentNeutralization: false },
    };
    const disabledResult = applyContentNeutralization(document, EMPTY_ANALYSIS_SUMMARY, policy, "balanced");
    expect(disabledResult.ruleCount).toBe(0);
    expect([...document.querySelectorAll("style")].some((style) => style.textContent?.includes("background:none !important"))).toBe(false);
  });

  it("does not generate neutralization CSS from redacted selectors", () => {
    const finding: Finding = {
      id: "redacted",
      severity: "critical",
      confidence: 99,
      pageUrl: "https://app.example/",
      pageOrigin: "https://app.example",
      frameUrl: "https://app.example/",
      frameOrigin: "https://app.example",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/style.css",
      sourceOrigin: "https://app.example",
      selector: 'input[value^="[redacted]"]~div',
      property: "background-image",
      destinationOrigin: "https://attacker.example",
      destinationUrl: "https://attacker.example/a.png",
      action: "logged",
      state: "analysis.complete",
      reasons: ["selector.attribute.prefix_match", "sink.remote_url", "url.remote"],
      timestamp: Date.now(),
      details: "redacted selector test",
    };
    expect(neutralizationRuleForFinding(finding)).toBeNull();
  });
});
