import type { DeclarationInfo, ReasonCode } from "../../shared/types";

const NETWORK_SINK_PROPERTIES = new Set([
  "background", "background-image", "border-image", "border-image-source", "list-style", "list-style-image",
  "cursor", "content", "mask", "mask-image", "-webkit-mask", "-webkit-mask-image", "clip-path", "filter",
  "fill", "stroke", "marker", "marker-start", "marker-mid", "marker-end"
]);

const SVG_PAINT_SINK_PROPERTIES = new Set(["fill", "stroke", "marker", "marker-start", "marker-mid", "marker-end"]);
const FONT_REFERENCE_PROPERTIES = new Set(["font", "font-family"]);
const COMMON_REMOTE_IMPORT_HOSTS = new Set(["fonts.googleapis.com", "use.typekit.net"]);

export interface DeclarationRisk {
  score: number;
  reasons: ReasonCode[];
  hasRemoteSink: boolean;
  hasAnyUrlSink: boolean;
  hasCssOnlyRisk: boolean;
  hasNetworkCapableProperty: boolean;
  isStandaloneFontFace: boolean;
}

export function analyzeDeclarationRisk(declaration: DeclarationInfo, ruleType: "style" | "font-face" | "import"): DeclarationRisk {
  const reasons = new Set<ReasonCode>();
  let score = 0;
  const property = declaration.property.toLowerCase();
  const value = declaration.resolvedValue.toLowerCase();
  const hasAnyUrlSink = declaration.urls.length > 0;
  const hasRemoteSink = declaration.urls.some((url) => url.isRemote);
  const hasCrossOriginSink = declaration.urls.some((url) => url.isRemote && url.isCrossOrigin);
  const hasNetworkCapableProperty = NETWORK_SINK_PROPERTIES.has(property) || FONT_REFERENCE_PROPERTIES.has(property) || ruleType === "import" || ruleType === "font-face";
  let hasCssOnlyRisk = false;

  if (ruleType === "import" && hasCrossOriginSink) {
    if (isCommonRemoteStylesheetImport(declaration)) {
      // Common font-provider @import rules are normal site plumbing and should not be
      // treated as blocked exfiltration attempts in Balanced mode. Unknown cross-origin
      // imports, including attacker-controlled fixtures, remain actionable.
      reasons.add("url.remote");
      return {
        score,
        reasons: [...reasons],
        hasRemoteSink,
        hasAnyUrlSink,
        hasCssOnlyRisk,
        hasNetworkCapableProperty,
        isStandaloneFontFace: false,
      };
    }
    score += 6;
    reasons.add("sink.import_remote");
  } else if (ruleType === "font-face" && hasCrossOriginSink) {
    // A standalone remote font is common on modern sites and is not CSS exfiltration by itself.
    // Keep the reason for diagnostics, but do not make it a high-confidence finding without a
    // separate selector-driven font-family reference.
    score += 1;
    reasons.add("sink.font_remote");
  } else if (FONT_REFERENCE_PROPERTIES.has(property) && hasCrossOriginSink) {
    score += 5;
    reasons.add("sink.font_remote");
  } else if (NETWORK_SINK_PROPERTIES.has(property) && hasCrossOriginSink) {
    score += 5;
    reasons.add("sink.remote_url");
    if (property === "content") reasons.add("sink.inline_remote_url");
  } else if (NETWORK_SINK_PROPERTIES.has(property) && hasAnyUrlSink) {
    score += 1;
  }

  if (property === "position" && /\bfixed\b/.test(value) && /!\s*important\b/.test(value)) {
    hasCssOnlyRisk = true;
    score += 3;
    reasons.add("css.fixed_position.important");
  }

  if (hasAnyUrlSink && declaration.urls.some((url) => url.isCrossOrigin)) { score += 2; reasons.add("url.cross_origin"); }
  if (hasAnyUrlSink && declaration.urls.some((url) => url.isHighEntropy)) { score += 1; reasons.add("url.high_entropy"); }
  if (hasAnyUrlSink && declaration.urls.some((url) => url.isLocalNetwork)) { score += 2; reasons.add("url.local_network"); }
  if (hasAnyUrlSink && declaration.urls.some((url) => url.isSvgReference)) reasons.add("sink.svg_reference");
  if (SVG_PAINT_SINK_PROPERTIES.has(property) && hasRemoteSink) reasons.add("sink.svg_paint_remote");

  if (declaration.usesUnresolvedVar && hasNetworkCapableProperty) {
    score += 1;
    reasons.add("css.custom_property.unresolved");
  }
  if (declaration.usesCustomPropertyUrl) {
    reasons.add("css.custom_property.url_sink");
    if (hasCrossOriginSink) score += 2;
  }
  if (hasRemoteSink) reasons.add("url.remote");

  return {
    score,
    reasons: [...reasons],
    hasRemoteSink,
    hasAnyUrlSink,
    hasCssOnlyRisk,
    hasNetworkCapableProperty,
    isStandaloneFontFace: ruleType === "font-face",
  };
}

function isCommonRemoteStylesheetImport(declaration: DeclarationInfo): boolean {
  const remoteCrossOriginUrls = declaration.urls.filter((url) => url.isRemote && url.isCrossOrigin);
  if (remoteCrossOriginUrls.length === 0) return false;
  return remoteCrossOriginUrls.every((url) => {
    if (!url.normalized) return false;
    try {
      return COMMON_REMOTE_IMPORT_HOSTS.has(new URL(url.normalized).hostname.toLowerCase());
    } catch {
      return false;
    }
  });
}
