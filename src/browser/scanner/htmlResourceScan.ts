import type { AnalysisSummary, Finding, ReasonCode, SitePolicy, SourceKind } from "../../shared/types";
import { analyzeResourceUrl, extractUrls } from "../../core/css/normalizeUrl";
import { createFinding } from "../../core/findings/createFinding";
import { analyzeStylesheet } from "../../core/analyzer/analyzeStylesheet";
import { mergeSummaries } from "./summarize";

interface HtmlResourceInput {
  documentRef: Document;
  pageUrl: string;
  frameUrl: string;
  policy?: SitePolicy;
}

interface AttributeFindingInput {
  element: Element;
  attributeName: string;
  rawValue: string;
  sourceKind: SourceKind;
  property: string;
  reasons: ReasonCode[];
  details: string;
  minSeverity?: "medium" | "high";
}

export function scanHtmlResourceAttributes(input: HtmlResourceInput): AnalysisSummary {
  const now = Date.now();
  const summaries: AnalysisSummary[] = [];
  const findings: Finding[] = [];
  const push = (item: AttributeFindingInput) => {
    const url = analyzeAttributeUrl(item.rawValue, input.pageUrl);
    if (!url?.isRemote) return;
    const reasons = new Set<ReasonCode>([...item.reasons, "url.remote"]);
    if (url.isCrossOrigin) reasons.add("url.cross_origin");
    if (url.isHighEntropy) reasons.add("url.high_entropy");
    if (url.isLocalNetwork) reasons.add("url.local_network");
    if (url.isSvgReference) reasons.add("sink.svg_reference");
    const severity = item.minSeverity === "high" || url.isLocalNetwork ? "high" : "medium";
    findings.push(createFinding({
      severity,
      confidence: severity === "high" ? 92 : 78,
      pageUrl: input.pageUrl,
      frameUrl: input.frameUrl,
      sourceKind: item.sourceKind,
      sourceUrl: input.frameUrl,
      selector: selectorForElement(item.element),
      property: item.property,
      destinationUrl: url.normalized,
      state: "analysis.complete",
      reasons: [...reasons],
      details: item.details,
    }));
  };

  const body = input.documentRef.body;
  const background = body?.getAttribute("background");
  if (body && background) {
    push({
      element: body,
      attributeName: "background",
      rawValue: background,
      sourceKind: "html_attribute",
      property: "background",
      reasons: ["sink.html_body_background"],
      details: "HTML body background attribute loads a remote resource.",
    });
  }

  for (const link of Array.from(input.documentRef.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'))) {
    const href = link.getAttribute("href") ?? "";
    const dataCss = decodeDataStylesheet(href);
    if (dataCss !== null) {
      summaries.push(addReasonToSummary(
        analyzeStylesheet({
          cssText: dataCss,
          pageUrl: input.pageUrl,
          frameUrl: input.frameUrl,
          sourceKind: "stylesheet_link",
          sourceUrl: "data:text/css,[redacted]",
        }),
        "source.data_stylesheet",
      ));
    }

    const url = analyzeAttributeUrl(href, input.pageUrl);
    if (!url?.isRemote || !url.isLocalNetwork) continue;
    push({
      element: link,
      attributeName: "href",
      rawValue: href,
      sourceKind: "stylesheet_link",
      property: "href",
      reasons: ["sink.stylesheet_link_remote"],
      details: "Stylesheet link points to a local/private-network destination.",
      minSeverity: "high",
    });
  }

  if (input.policy?.compatibility.reportExternalSvgImageDocuments) {
    findings.push(...scanExternalSvgImageDocuments(input));
  }

  for (const feImage of Array.from(input.documentRef.querySelectorAll("feImage"))) {
    const href = getSvgHref(feImage);
    if (!href) continue;
    push({
      element: feImage,
      attributeName: "href",
      rawValue: href,
      sourceKind: "svg_attribute",
      property: "href",
      reasons: ["sink.svg_feimage_remote"],
      details: "SVG feImage references a remote resource.",
      minSeverity: "high",
    });
  }

  for (const animate of Array.from(input.documentRef.querySelectorAll("animate, animateTransform, animateMotion, set"))) {
    const attributeName = (animate.getAttribute("attributeName") ?? "").toLowerCase();
    if (attributeName && !["href", "xlink:href", "fill", "filter", "stroke"].includes(attributeName)) continue;
    const value = ["values", "from", "to", "by"].map((name) => animate.getAttribute(name)).filter((candidate): candidate is string => Boolean(candidate)).join(";");
    if (!value) continue;
    push({
      element: animate,
      attributeName: "values",
      rawValue: value,
      sourceKind: "svg_attribute",
      property: attributeName || "values",
      reasons: ["sink.svg_animate_remote"],
      details: "SVG animation attribute references a remote resource.",
      minSeverity: "high",
    });
  }

  summaries.unshift({
    state: findings.some((finding) => finding.state !== "analysis.complete") ? "analysis.partial" : "analysis.complete",
    findings,
    analyzedStylesheets: 0,
    partialStylesheets: findings.some((finding) => finding.state === "svg.image_document.uninspectable") ? 1 : 0,
    analyzedFrames: 0,
    partialFrames: 0,
    startedAt: now,
    finishedAt: Date.now(),
  });
  return mergeSummaries(summaries);
}

function scanExternalSvgImageDocuments(input: HtmlResourceInput): Finding[] {
  const candidates: Array<{ element: Element; rawValue: string; property: string }> = [];
  for (const element of Array.from(input.documentRef.querySelectorAll("img[src], image[href], image[xlink\\:href], object[data], embed[src]"))) {
    const rawValue = element.getAttribute("src") ?? element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? element.getAttribute("data") ?? "";
    if (!rawValue || !isSvgImageReference(rawValue)) continue;
    candidates.push({ element, rawValue, property: element.hasAttribute("data") ? "data" : element.hasAttribute("src") ? "src" : "href" });
  }

  return candidates.map((candidate) => {
    const url = analyzeAttributeUrl(candidate.rawValue, input.pageUrl);
    const reasons = new Set<ReasonCode>(["resource.svg_image_document.uninspectable"]);
    if (url?.isRemote) reasons.add("url.remote");
    if (url?.isCrossOrigin) reasons.add("url.cross_origin");
    if (url?.isLocalNetwork) reasons.add("url.local_network");
    return createFinding({
      severity: "info",
      confidence: 100,
      pageUrl: input.pageUrl,
      frameUrl: input.frameUrl,
      sourceKind: "svg_image_resource",
      sourceUrl: input.frameUrl,
      selector: selectorForElement(candidate.element),
      property: candidate.property,
      destinationUrl: normalizedSvgImageDestination(candidate.rawValue, url?.normalized),
      state: "svg.image_document.uninspectable",
      reasons: [...reasons],
      details: "Externally loaded SVG image documents are treated as partial coverage because their internal CSS/DOM may not be inspectable from the page content script.",
    });
  });
}

function addReasonToSummary(summary: AnalysisSummary, reason: ReasonCode): AnalysisSummary {
  return {
    ...summary,
    findings: summary.findings.map((finding) => ({
      ...finding,
      reasons: Array.from(new Set([...finding.reasons, reason])),
    })),
  };
}

function decodeDataStylesheet(href: string): string | null {
  const trimmed = href.trim();
  const match = /^data:([^,]*),(.*)$/is.exec(trimmed);
  if (!match) return null;
  const metadata = (match[1] ?? "").toLowerCase();
  if (!metadata.split(";")[0].startsWith("text/css")) return null;
  const body = match[2] ?? "";
  if (metadata.split(";").includes("base64")) {
    try {
      if (typeof atob === "function") return atob(body.replace(/\s+/g, ""));
    } catch {
      return null;
    }
  }
  try {
    return decodeURIComponent(body.replace(/\+/g, "%20"));
  } catch {
    return body;
  }
}

function analyzeAttributeUrl(rawValue: string, baseUrl: string) {
  const cssUrls = extractUrls(rawValue, baseUrl);
  if (cssUrls.length > 0) return cssUrls.find((url) => url.isRemote) ?? cssUrls[0];
  return analyzeResourceUrl(rawValue, baseUrl);
}

function getSvgHref(element: Element): string | null {
  return element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? element.getAttributeNS("http://www.w3.org/1999/xlink", "href");
}

function normalizedSvgImageDestination(rawValue: string, normalized: string | null | undefined): string {
  if (/^data:\s*image\/svg\+xml/i.test(rawValue.trim())) return "data:image/svg+xml,[redacted]";
  return normalized ?? rawValue;
}

function isSvgImageReference(value: string): boolean {
  const trimmed = value.trim();
  if (/^data:\s*image\/svg\+xml/i.test(trimmed)) return true;
  return /\.svg(?:[?#].*)?$/i.test(trimmed);
}

function selectorForElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${escapeSelectorSegment(element.id)}` : "";
  const name = element.getAttribute("name");
  const namePart = name ? `[name=${JSON.stringify(name)}]` : "";
  const type = element.getAttribute("type");
  const typePart = type ? `[type=${JSON.stringify(type)}]` : "";
  return `${tag}${id}${namePart}${typePart}` || tag;
}

function escapeSelectorSegment(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}
