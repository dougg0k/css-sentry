import { ANALYSIS_LIMITS } from "../../shared/constants";
import type { AnalysisSummary, SitePolicy } from "../../shared/types";
import { getOrigin } from "../../shared/url";
import { analyzeStylesheet } from "../../core/analyzer/analyzeStylesheet";
import { mergeSummaries } from "./summarize";
import { scanHtmlResourceAttributes } from "./htmlResourceScan";
import { createPartialFrameSummary, createPartialStylesheetSummary } from "./coverageSummary";

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
        enableCssFingerprintingGuard: policy?.compatibility.enableCssFingerprintingGuard ?? false,
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
          enableCssFingerprintingGuard: policy?.compatibility.enableCssFingerprintingGuard ?? false,
        }),
      );
    } catch {
      ownSummaries.push(createPartialStylesheetSummary(pageUrl, frameUrl, sheet.href));
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
        enableCssFingerprintingGuard: policy?.compatibility.enableCssFingerprintingGuard ?? false,
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

  if (frameOrigin && pageOrigin && frameOrigin !== pageOrigin) return createPartialFrameSummary(pageUrl, frameUrl);

  try {
    if (!iframe.contentDocument) return createPartialFrameSummary(pageUrl, frameUrl);
    return scanDocument(iframe.contentDocument, policy);
  } catch {
    return createPartialFrameSummary(pageUrl, frameUrl);
  }
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
