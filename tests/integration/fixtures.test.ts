import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { analyzeStylesheet } from "../../src/core/analyzer/analyzeStylesheet";
import { createFinding } from "../../src/core/findings/createFinding";
import { mergeSummaries } from "../../src/browser/scanner/summarize";
import { scanHtmlResourceAttributes } from "../../src/browser/scanner/htmlResourceScan";
import type { AnalysisSummary, Finding, ReasonCode, Severity, SourceKind } from "../../src/shared/types";

const root = join(process.cwd(), "tests", "fixtures");
const pageUrl = "https://app.example.test/page";
const severityOrder: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

interface FixtureExpectation {
  description: string;
  minActionableFindings?: number;
  maxActionableFindings?: number;
  minInfoFindings?: number;
  severityAtLeast?: Severity;
  requiredReasons?: ReasonCode[];
  forbiddenReasons?: ReasonCode[];
  requiredDestinationOrigins?: string[];
  forbiddenDestinationOrigins?: string[];
  minPartialFrames?: number;
  minAnalyzedFrames?: number;
  mustBeBlockCandidate?: boolean;
  mustNotBeBlockCandidate?: boolean;
}

function fixtureFiles(kind: "attacks" | "benign"): string[] {
  return readdirSync(join(root, kind)).filter((name) => /\.(css|html)$/.test(name)).sort();
}

function expectedPath(kind: "attacks" | "benign", name: string): string {
  return join(root, kind, `${name}.expected.json`);
}

function readExpectation(kind: "attacks" | "benign", name: string): FixtureExpectation {
  const path = expectedPath(kind, name);
  expect(existsSync(path), `${kind}/${name} must have a matching .expected.json file`).toBe(true);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as FixtureExpectation;
  expect(parsed.description, `${kind}/${name} expectation must explain the fixture purpose`).toBeTruthy();
  return parsed;
}

function analyzeFixture(kind: "attacks" | "benign", name: string): AnalysisSummary {
  const path = join(root, kind, name);
  const text = readFileSync(path, "utf8");
  if (name.endsWith(".html")) return analyzeHtmlFixture(text, path, pageUrl);
  return analyzeStylesheet({ cssText: text, pageUrl, sourceKind: "stylesheet", sourceUrl: pageUrl });
}

function analyzeHtmlFixture(html: string, filePath: string, frameUrl: string): AnalysisSummary {
  const summaries: AnalysisSummary[] = [];
  const parsedDocument = new DOMParser().parseFromString(html, "text/html");
  summaries.push(scanHtmlResourceAttributes({ documentRef: parsedDocument, pageUrl, frameUrl }));

  for (const styleText of extractStyleBlocks(html)) {
    summaries.push(analyzeStylesheet({ cssText: styleText, pageUrl, frameUrl, sourceKind: "style_element", sourceUrl: frameUrl }));
  }

  for (const inline of extractInlineStyleRules(html)) {
    summaries.push(analyzeStylesheet({ cssText: `${inline.selector}{${inline.styleText}}`, pageUrl, frameUrl, sourceKind: "inline_style", sourceUrl: frameUrl }));
  }

  for (const src of extractIframeSources(html)) {
    const iframeUrl = new URL(src, frameUrl).href;
    const iframeOrigin = new URL(iframeUrl).origin;
    const pageOrigin = new URL(pageUrl).origin;
    if (iframeOrigin !== pageOrigin) {
      summaries.push(partialFrameSummary(frameUrl, iframeUrl));
      continue;
    }

    const target = fixturePathForIframe(src, filePath);
    if (target && existsSync(target)) {
      summaries.push(analyzeHtmlFixture(readFileSync(target, "utf8"), target, iframeUrl));
    } else {
      summaries.push(partialFrameSummary(frameUrl, iframeUrl));
    }
  }

  const ownSummary = mergeSummaries(summaries);
  return { ...ownSummary, analyzedFrames: ownSummary.analyzedFrames + 1 };
}

function extractStyleBlocks(html: string): string[] {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1] ?? "");
}

interface InlineStyleRule {
  selector: string;
  styleText: string;
}

function extractInlineStyleRules(html: string): InlineStyleRule[] {
  const documentRef = new DOMParser().parseFromString(html, "text/html");
  return Array.from(documentRef.querySelectorAll<HTMLElement>("[style]")).map((element) => ({
    selector: fixtureElementSelector(element),
    styleText: element.getAttribute("style") ?? "",
  }));
}

function fixtureElementSelector(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id.replace(/[^a-zA-Z0-9_-]/g, "\\$&")}` : "";
  const name = element.getAttribute("name");
  const namePart = name ? `[name=${JSON.stringify(name)}]` : "";
  const type = element.getAttribute("type");
  const typePart = type ? `[type=${JSON.stringify(type)}]` : "";
  return `${tag}${id}${namePart}${typePart}` || "*";
}

function extractIframeSources(html: string): string[] {
  return [...html.matchAll(/<iframe\b[^>]*\ssrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)].map((match) => (match[1] ?? "").replace(/^['"]|['"]$/g, ""));
}

function fixturePathForIframe(src: string, parentFilePath: string): string | null {
  if (/^https?:\/\//i.test(src)) return null;
  if (src.startsWith("/fixtures/")) return normalize(join(process.cwd(), "tests", src.slice(1)));
  return normalize(join(dirname(parentFilePath), src));
}

function partialFrameSummary(parentFrameUrl: string, frameUrl: string): AnalysisSummary {
  const now = Date.now();
  return {
    state: "analysis.partial",
    findings: [
      createFinding({
        severity: "info",
        confidence: 100,
        pageUrl,
        frameUrl,
        sourceKind: "frame" as SourceKind,
        sourceUrl: frameUrl,
        state: "frame.cross_origin_uninspectable",
        reasons: ["frame.cross_origin.uninspectable"],
        details: `Frame content was not inspectable from ${parentFrameUrl}.`,
      }),
    ],
    analyzedStylesheets: 0,
    partialStylesheets: 0,
    analyzedFrames: 0,
    partialFrames: 1,
    startedAt: now,
    finishedAt: now,
  };
}

function assertExpectation(kind: "attacks" | "benign", name: string, summary: AnalysisSummary, expectation: FixtureExpectation): void {
  const findings = summary.findings;
  const actionable = findings.filter((finding) => finding.severity !== "info");
  const infoFindings = findings.filter((finding) => finding.severity === "info");
  const reasonSet = new Set(findings.flatMap((finding) => finding.reasons));
  const destinationSet = new Set(findings.map((finding) => finding.destinationOrigin).filter((origin): origin is string => typeof origin === "string"));

  if (expectation.minActionableFindings !== undefined) {
    expect(actionable.length, `${kind}/${name} actionable finding count`).toBeGreaterThanOrEqual(expectation.minActionableFindings);
  }
  if (expectation.maxActionableFindings !== undefined) {
    expect(actionable.length, `${kind}/${name} actionable finding count`).toBeLessThanOrEqual(expectation.maxActionableFindings);
  }
  if (expectation.minInfoFindings !== undefined) {
    expect(infoFindings.length, `${kind}/${name} info finding count`).toBeGreaterThanOrEqual(expectation.minInfoFindings);
  }
  if (expectation.severityAtLeast !== undefined && actionable.length > 0) {
    const maxSeverity = Math.max(...actionable.map((finding) => severityOrder[finding.severity]));
    expect(maxSeverity, `${kind}/${name} maximum severity`).toBeGreaterThanOrEqual(severityOrder[expectation.severityAtLeast]);
  }
  for (const reason of expectation.requiredReasons ?? []) {
    expect(reasonSet.has(reason), `${kind}/${name} should include reason ${reason}`).toBe(true);
  }
  for (const reason of expectation.forbiddenReasons ?? []) {
    expect(reasonSet.has(reason), `${kind}/${name} should not include reason ${reason}`).toBe(false);
  }
  for (const origin of expectation.requiredDestinationOrigins ?? []) {
    expect(destinationSet.has(origin), `${kind}/${name} should include destination origin ${origin}`).toBe(true);
  }
  for (const origin of expectation.forbiddenDestinationOrigins ?? []) {
    expect(destinationSet.has(origin), `${kind}/${name} should not include destination origin ${origin}`).toBe(false);
  }
  if (expectation.minPartialFrames !== undefined) {
    expect(summary.partialFrames, `${kind}/${name} partial frame count`).toBeGreaterThanOrEqual(expectation.minPartialFrames);
  }
  if (expectation.minAnalyzedFrames !== undefined) {
    expect(summary.analyzedFrames, `${kind}/${name} analyzed frame count`).toBeGreaterThanOrEqual(expectation.minAnalyzedFrames);
  }
  if (expectation.mustBeBlockCandidate) {
    expect(actionable.some(isBlockCandidate), `${kind}/${name} should include a high-confidence block candidate`).toBe(true);
  }
  if (expectation.mustNotBeBlockCandidate) {
    expect(actionable.some(isBlockCandidate), `${kind}/${name} should not include a block candidate`).toBe(false);
  }
}

function isBlockCandidate(finding: Finding): boolean {
  return Boolean(finding.destinationOrigin) && severityOrder[finding.severity] >= severityOrder.high;
}

describe("fixture corpus", () => {
  it("has expectation files for every active fixture and no orphan expectations", () => {
    for (const kind of ["attacks", "benign"] as const) {
      const fixtures = new Set(fixtureFiles(kind));
      const expectations = readdirSync(join(root, kind)).filter((name) => name.endsWith(".expected.json")).sort();
      for (const fixture of fixtures) expect(existsSync(expectedPath(kind, fixture)), `${kind}/${fixture}`).toBe(true);
      for (const expectation of expectations) {
        const fixture = expectation.replace(/\.expected\.json$/, "");
        expect(fixtures.has(fixture), `${kind}/${expectation} should match an active fixture`).toBe(true);
      }
    }
  });

  for (const name of fixtureFiles("attacks")) {
    it(`matches attack fixture expectations for ${name}`, () => {
      const summary = analyzeFixture("attacks", name);
      assertExpectation("attacks", name, summary, readExpectation("attacks", name));
    });
  }

  for (const name of fixtureFiles("benign")) {
    it(`matches benign fixture expectations for ${name}`, () => {
      const summary = analyzeFixture("benign", name);
      assertExpectation("benign", name, summary, readExpectation("benign", name));
    });
  }
});
