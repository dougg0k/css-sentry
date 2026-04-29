import type { DeclarationInfo, ReasonCode } from "../../shared/types";

const NETWORK_SINK_PROPERTIES = new Set([
  "background", "background-image", "border-image", "border-image-source", "list-style", "list-style-image",
  "cursor", "content", "mask", "mask-image", "-webkit-mask", "-webkit-mask-image", "clip-path", "filter",
  "fill", "stroke", "marker", "marker-start", "marker-mid", "marker-end"
]);

const SVG_PAINT_SINK_PROPERTIES = new Set(["fill", "stroke", "marker", "marker-start", "marker-mid", "marker-end"]);

export interface DeclarationRisk {
  score: number;
  reasons: ReasonCode[];
  hasRemoteSink: boolean;
  hasAnyUrlSink: boolean;
  hasCssOnlyRisk: boolean;
}

export function analyzeDeclarationRisk(declaration: DeclarationInfo, ruleType: "style" | "font-face" | "import"): DeclarationRisk {
  const reasons = new Set<ReasonCode>();
  let score = 0;
  const property = declaration.property.toLowerCase();
  const value = declaration.resolvedValue.toLowerCase();
  const hasAnyUrlSink = declaration.urls.length > 0;
  const hasRemoteSink = declaration.urls.some((url) => url.isRemote);
  const hasCrossOriginSink = declaration.urls.some((url) => url.isRemote && url.isCrossOrigin);
  let hasCssOnlyRisk = false;

  if (ruleType === "import" && hasCrossOriginSink) { score += 6; reasons.add("sink.import_remote"); }
  else if (ruleType === "font-face" && hasCrossOriginSink) { score += 5; reasons.add("sink.font_remote"); }
  else if (NETWORK_SINK_PROPERTIES.has(property) && hasCrossOriginSink) {
    score += 5; reasons.add("sink.remote_url");
    if (property === "content") reasons.add("sink.inline_remote_url");
  } else if (NETWORK_SINK_PROPERTIES.has(property) && hasAnyUrlSink) {
    score += 1;
  }

  if (property === "position" && /\bfixed\b/.test(value) && /!\s*important\b/.test(value)) {
    hasCssOnlyRisk = true;
    score += 3;
    reasons.add("css.fixed_position.important");
  }

  if (declaration.urls.some((url) => url.isCrossOrigin)) { score += 2; reasons.add("url.cross_origin"); }
  if (declaration.urls.some((url) => url.isHighEntropy)) { score += 1; reasons.add("url.high_entropy"); }
  if (declaration.urls.some((url) => url.isLocalNetwork)) { score += 2; reasons.add("url.local_network"); }
  if (declaration.urls.some((url) => url.isSvgReference)) reasons.add("sink.svg_reference");
  if (SVG_PAINT_SINK_PROPERTIES.has(property) && hasRemoteSink) reasons.add("sink.svg_paint_remote");
  if (declaration.usesUnresolvedVar) { score += 1; reasons.add("css.custom_property.unresolved"); }
  if (declaration.usesCustomPropertyUrl) {
    reasons.add("css.custom_property.url_sink");
    if (hasCrossOriginSink) score += 2;
  }
  if (hasRemoteSink) reasons.add("url.remote");

  return { score, reasons: [...reasons], hasRemoteSink, hasAnyUrlSink, hasCssOnlyRisk };
}
