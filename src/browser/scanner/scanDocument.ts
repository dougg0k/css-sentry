import { ANALYSIS_LIMITS } from "../../shared/constants";
import type { AnalysisSummary, SitePolicy } from "../../shared/types";
import { getOrigin } from "../../shared/url";
import { analyzeStylesheet } from "../../core/analyzer/analyzeStylesheet";
import { createFinding } from "../../core/findings/createFinding";
import { mergeSummaries } from "./summarize";
import { scanHtmlResourceAttributes } from "./htmlResourceScan";

export function scanDocument(documentRef: Document = document, policy?: SitePolicy): AnalysisSummary {
  const pageUrl = documentRef.location.href;
  const frameUrl = documentRef.location.href;
  const ownSummaries: AnalysisSummary[] = [];
  const childFrameSummaries: AnalysisSummary[] = [];
  let inlineStyleCount = 0;

  ownSummaries.push(scanHtmlResourceAttributes({ documentRef, pageUrl, frameUrl, policy }));

  for (const styleElement of Array.from(documentRef.querySelectorAll("style"))) {
    ownSummaries.push(
      analyzeStylesheet({
        cssText: styleElement.textContent ?? "",
        pageUrl,
        sourceKind: "style_element",
        sourceUrl: pageUrl,
        frameUrl,
      }),
    );
  }

  for (const sheet of Array.from(documentRef.styleSheets)) {
    const owner = sheet.ownerNode as Element | null;
    if (owner?.tagName.toLowerCase() === "style") continue;
    try {
      const cssText = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      ownSummaries.push(
        analyzeStylesheet({
          cssText,
          pageUrl,
          sourceKind: "stylesheet",
          sourceUrl: sheet.href,
          frameUrl,
        }),
      );
    } catch {
      ownSummaries.push(partialStylesheetSummary(pageUrl, frameUrl, sheet.href));
    }
  }

  for (const element of Array.from(documentRef.querySelectorAll<HTMLElement>("[style]"))) {
    if (inlineStyleCount >= ANALYSIS_LIMITS.maxInlineStyleElements) break;
    inlineStyleCount += 1;
    const styleValue = element.getAttribute("style") ?? "";
    const selector = stableElementSelector(element);
    ownSummaries.push(
      analyzeStylesheet({
        cssText: `${selector}{${styleValue}}`,
        pageUrl,
        sourceKind: "inline_style",
        sourceUrl: pageUrl,
        frameUrl,
      }),
    );
  }

  for (const iframe of Array.from(documentRef.querySelectorAll<HTMLIFrameElement>("iframe"))) {
    const summary = inspectFrame(documentRef, iframe, pageUrl, policy);
    if (summary) childFrameSummaries.push(summary);
  }

  const ownSummary = mergeSummaries(ownSummaries);
  const currentFrameIsPartial = ownSummary.state !== "analysis.complete" || ownSummary.partialStylesheets > 0;
  return mergeSummaries([
    { ...ownSummary, analyzedFrames: 1, partialFrames: currentFrameIsPartial ? 1 : 0 },
    ...childFrameSummaries,
  ]);
}

function inspectFrame(documentRef: Document, iframe: HTMLIFrameElement, pageUrl: string, policy?: SitePolicy): AnalysisSummary | null {
  const frameUrl = iframe.src || "about:blank";
  const pageOrigin = getOrigin(pageUrl);
  const frameOrigin = getOrigin(frameUrl);

  if (frameOrigin && pageOrigin && frameOrigin !== pageOrigin) return partialFrameSummary(pageUrl, frameUrl);

  try {
    if (!iframe.contentDocument) return partialFrameSummary(pageUrl, frameUrl);
    return scanDocument(iframe.contentDocument, policy);
  } catch {
    return partialFrameSummary(pageUrl, frameUrl);
  }
}

function partialStylesheetSummary(pageUrl: string, frameUrl: string, sourceUrl: string | null): AnalysisSummary {
  const now = Date.now();
  return {
    state: "analysis.partial",
    findings: [
      createFinding({
        severity: "info",
        confidence: 100,
        pageUrl,
        frameUrl,
        sourceKind: "stylesheet",
        sourceUrl,
        state: "stylesheet.cross_origin_uninspectable",
        reasons: ["stylesheet.cross_origin.uninspectable"],
        details: "Stylesheet rules were not inspectable, usually because the browser restricted cross-origin stylesheet access.",
      }),
    ],
    analyzedStylesheets: 0,
    partialStylesheets: 1,
    analyzedFrames: 0,
    partialFrames: 0,
    startedAt: now,
    finishedAt: now,
  };
}

function partialFrameSummary(pageUrl: string, frameUrl: string): AnalysisSummary {
  const now = Date.now();
  return {
    state: "analysis.partial",
    findings: [
      createFinding({
        severity: "info",
        confidence: 100,
        pageUrl,
        frameUrl,
        sourceKind: "frame",
        sourceUrl: frameUrl,
        state: "frame.cross_origin_uninspectable",
        reasons: ["frame.cross_origin.uninspectable"],
        details: "Frame content was not inspectable, usually because the browser restricted cross-origin frame access.",
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

function stableElementSelector(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${cssEscape(element.id)}` : "";
  const name = element.getAttribute("name");
  const namePart = name ? `[name=${JSON.stringify(name)}]` : "";
  const type = element.getAttribute("type");
  const typePart = type ? `[type=${JSON.stringify(type)}]` : "";
  return `${tag}${id}${namePart}${typePart}` || "*";
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}
