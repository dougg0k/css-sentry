import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";


function walkFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return [path];
  });
}

describe("project structure", () => {
  it("uses tests/fixtures and not test-fixtures", () => {
    expect(existsSync(join(process.cwd(), "tests", "fixtures"))).toBe(true);
    expect(existsSync(join(process.cwd(), "test-fixtures"))).toBe(false);
  });
  it("has automated unit, integration, e2e, and UI tests", () => {
    for (const dir of ["tests/unit/core", "tests/unit/browser", "tests/unit/ui", "tests/integration", "tests/e2e"]) {
      expect(existsSync(join(process.cwd(), dir)), dir).toBe(true);
      expect(readdirSync(join(process.cwd(), dir)).some((file) => file.endsWith(".test.ts") || file.endsWith(".test.tsx") || file.endsWith(".spec.ts")), dir).toBe(true);
    }
  });

  it("keeps non-README project docs under docs/", () => {
    expect(existsSync(join(process.cwd(), "README.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "SPEC.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "CVE_SPEC.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "STATUS.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "SECURITY.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "PRIVACY.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "PERMISSIONS.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "SELF_SECURITY.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "RELEASE_CHECKLIST.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "RELEASE_NOTES.md"))).toBe(true);
    expect(existsSync(join(process.cwd(), "SPEC.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "CVE_SPEC.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "STATUS.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "SECURITY.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "PRIVACY.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "PERMISSIONS.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "RELEASE_CHECKLIST.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "SELF_SECURITY.md"))).toBe(false);
    expect(existsSync(join(process.cwd(), "RELEASE_NOTES.md"))).toBe(false);
  });

  it("keeps Last Updated metadata out of README", () => {
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(readme).not.toMatch(/Last Updated:/);
  });

  it("keeps SVG icon lightweight", () => {
    const size = statSync(join(process.cwd(), "src/assets/icon.svg")).size;
    expect(size).toBeLessThan(20_000);
  });

  it("keeps runtime and documentation image assets while preserving SVG", () => {
    expect(existsSync(join(process.cwd(), "src/assets/icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/assets/icon.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "chrome-extension-logo.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "docs", "firefox-addon-logo.svg"))).toBe(true);
  });


  it("keeps the false-positive sweep as a development-only tool", () => {
    expect(existsSync(join(process.cwd(), "scripts", "false-positive-sweep.mjs"))).toBe(true);
    expect(existsSync(join(process.cwd(), "scripts", "false-positive-sites.txt"))).toBe(true);
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.["audit:false-positives"]).toBe("node scripts/false-positive-sweep.mjs");
    const script = readFileSync(join(process.cwd(), "scripts", "false-positive-sweep.mjs"), "utf8");
    expect(script).toContain("test-results/false-positive-sweep");
    expect(script).not.toContain("fetch(");
  });

  it("ignores generated test output directories and AI reports", () => {
    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toContain("test-results");
    expect(gitignore).toContain("json-report.json");
  });

  it("keeps React entrypoints small by moving repeated UI into components", () => {
    expect(existsSync(join(process.cwd(), "src", "shared", "components", "InfoTooltip.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src", "entrypoints", "options", "components.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src", "entrypoints", "popup", "components.tsx"))).toBe(true);

    const maxEntrypointLines: Record<string, number> = {
      "src/entrypoints/options/OptionsApp.tsx": 260,
      "src/entrypoints/popup/App.tsx": 180,
    };
    for (const [file, maxLines] of Object.entries(maxEntrypointLines)) {
      const lineCount = readFileSync(join(process.cwd(), file), "utf8").split("\n").length;
      expect(lineCount, `${file} should stay orchestration-focused`).toBeLessThanOrEqual(maxLines);
    }
  });
  it("does not use extension UI HTML injection or dynamic code execution sinks", () => {
    const files = walkFiles(join(process.cwd(), "src")).filter((file) => /\.(ts|tsx|js|jsx|html|css)$/.test(file));
    const forbiddenPatterns = [
      /dangerouslySetInnerHTML/,
      /\.innerHTML\s*=/,
      /insertAdjacentHTML\s*\(/,
      /\beval\s*\(/,
      /new\s+Function\s*\(/,
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(text), `${file} must not contain ${pattern}`).toBe(false);
      }
    }
  });

  it("documents the self-security safeguards", () => {
    const text = readFileSync(join(process.cwd(), "docs", "SELF_SECURITY.md"), "utf8");
    for (const marker of ["SS-001", "SS-002", "SS-003", "SS-004", "SS-005", "SS-006", "SS-007", "SS-008", "SS-009", "SS-010", "SS-011", "SS-012", "SS-013", "SS-014", "SS-015"]) {
      expect(text).toContain(marker);
    }
    expect(text).toContain("Extension UI injection invariant");
    expect(text).toContain("not CSS-specific");
    expect(text).toContain("Documentation regression prevention");
  });

  it("keeps Firefox enhanced stylesheet inspection aligned with large-source scanning", () => {
    const text = readFileSync(join(process.cwd(), "src", "browser", "firefox", "enhancedStylesheetInspection.ts"), "utf8");
    expect(text).not.toContain("maxStyleTextBytes");
    expect(text).not.toMatch(/totalBytes\s*>/);
    expect(text).toContain("analyzeStylesheet");
    expect(text).toContain("filter.write(event.data)");
  });

  it("keeps manifest permissions aligned with the documented minimal set", async () => {
    const config = readFileSync(join(process.cwd(), "wxt.config.ts"), "utf8");
    expect(config).toContain('permissions: ["storage", "declarativeNetRequest", "webNavigation", "webRequest"]');
    expect(config).not.toContain('"activeTab"');
    expect(config).not.toContain('"scripting"');
    expect(config).not.toContain("optional_host_permissions");
    expect(config).not.toContain('"webRequestBlocking"');
  });

  it("protects documentation from destructive summary regressions", () => {
    const requiredDocSizes: Record<string, number> = {
      "docs/SPEC.md": 40_000,
      "docs/CVE_SPEC.md": 12_000,
      "docs/STATUS.md": 18_000,
      "docs/SELF_SECURITY.md": 4_000,
      "docs/SECURITY.md": 3_500,
      "docs/PERMISSIONS.md": 2_000,
      "docs/PRIVACY.md": 2_500,
      "docs/RELEASE_NOTES.md": 12_000,
    };

    for (const [file, minimumBytes] of Object.entries(requiredDocSizes)) {
      const path = join(process.cwd(), file);
      const size = statSync(path).size;
      expect(size, `${file} must not be replaced by a thin summary`).toBeGreaterThanOrEqual(minimumBytes);
    }

    const spec = readFileSync(join(process.cwd(), "docs", "SPEC.md"), "utf8");
    const status = readFileSync(join(process.cwd(), "docs", "STATUS.md"), "utf8");
    const checklist = readFileSync(join(process.cwd(), "docs", "RELEASE_CHECKLIST.md"), "utf8");

    const cveSpec = readFileSync(join(process.cwd(), "docs", "CVE_SPEC.md"), "utf8");
    const releaseNotes = readFileSync(join(process.cwd(), "docs", "RELEASE_NOTES.md"), "utf8");

    expect(spec).toContain("Documentation and Regression Preservation Requirements");
    expect(spec).toContain("Supplemental Historical Issue Coverage");
    expect(spec).toContain("Historical Issue Preservation Requirement");
    expect(status).toContain("documentation restoration");
    expect(status).toContain("Implementation Coverage Index");
    expect(status).toContain("Historical Issue Coverage Tracking");
    expect(checklist).toContain("Documentation Regression Guard");
    expect(checklist).toContain("Documentation Role and Coverage Checks");
    expect(cveSpec).toContain("1.0.4 CVE Traceability Preservation Update");
    expect(cveSpec).toContain("1.0.5 CVE-2026-40301");
    expect(spec).toContain("1.0.6 Clean Code, UI Composition, and Scope-Tracking Addendum");
    expect(spec).toContain("1.0.7 Scope, Search Triage, and Fixture-Growth Addendum");
    expect(cveSpec).toContain("1.0.6 Adjacent CVE and Out-of-Scope Classification Update");
    expect(cveSpec).toContain("1.0.7 Search Triage and Added CVE/Advisory Classes");
    expect(status).toContain("1.0.6 maintenance, assets, UI refactor, and out-of-scope tracking");
    expect(status).toContain("1.0.7 search triage, fixture expansion, and status wording cleanup");
    expect(checklist).toContain("1.0.6 Additional Maintenance Checks");
    expect(checklist).toContain("1.0.7 Additional Search and Fixture Checks");
    expect(spec).toContain("1.0.10 Advanced Optional Coverage Requirements");
    expect(spec).toContain("1.0.21 Large-Stylesheet Source Scan Requirement");
    expect(spec).toContain("1.0.27 Inline Conditional CSS and Font Side-Channel Requirements");
    expect(spec).toContain("1.0.28");
    expect(spec).toContain("1.0.29 Fontleak Ligature Evidence Parsing Correction");
    expect(spec).toContain("1.0.30 DNR Action Semantics and Popup Clarity Correction");
    expect(spec).toContain("content-level neutralization");
    expect(spec).toContain("1.0.32 Neutralization and DNR Composition Requirement");
    expect(spec).toContain("1.0.33 Advisory Coverage and Firefox Enhanced Inspection Requirements");
    expect(spec).toContain("1.0.34 Hono and Tandoor Advisory Traceability Requirements");
    expect(status).toContain("1.0.10 Advanced SVG, Firefox, and Diagnostics Options");
    expect(status).toContain("1.0.21 Exploit-Resistance Review");
    expect(cveSpec).toContain("1.0.10 Advanced Optional CVE Coverage Policy");
    expect(cveSpec).toContain("1.0.27 CVE and Research Traceability Update");
    expect(cveSpec).toContain("Mermaid CSS injection advisory coverage");
    expect(cveSpec).toContain("justhtml sanitizer bypass advisory coverage");
    expect(cveSpec).toContain("XWiki CVE-2026-26000 classification");
    expect(cveSpec).toContain("Hono CVE-2026-44458 inline-style declaration injection coverage");
    expect(cveSpec).toContain("Tandoor CVE-2026-35046 fixture-backed coverage");
    expect(releaseNotes).toContain("## 1.0.10");
    expect(releaseNotes).toContain("## 1.0.21");
    expect(releaseNotes).toContain("## 1.0.27");
    expect(releaseNotes).toContain("## 1.0.28");
    expect(releaseNotes).toContain("## 1.0.29");
    expect(releaseNotes).toContain("## 1.0.30");
    expect(releaseNotes).toContain("## 1.0.31");
    expect(releaseNotes).toContain("## 1.0.32");
    expect(releaseNotes).toContain("## 1.0.33");
    expect(releaseNotes).toContain("## 1.0.34");
    expect(status).toContain("1.0.31 Audit Note");
    expect(status).toContain("1.0.32 Audit Note");
    expect(status).toContain("1.0.33 Audit Note");
    expect(status).toContain("1.0.34 Audit Note");
    expect(status).toContain("## Features Avoided");
    expect(status).not.toContain("## Features Avoided for v1");
    expect(status).not.toContain("| CI workflow |");
    expect(status).toContain("Covered for documented scope");
    expect(status).not.toContain("Covered for v1 scope");
    expect(status).toContain("Historical Issue Comment Audit");
    expect(status).toContain("Supposed / Known Limitations To Preserve");
    expect(releaseNotes).toContain("## 1.0.5");
    expect(releaseNotes).toContain("## 1.0.4");
    expect(releaseNotes).toContain("## 0.0.23");
    expect(releaseNotes).toContain("## 0.0.1 through 0.0.17");
  });

});
