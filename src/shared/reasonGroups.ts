import type { Finding, ReasonCode } from "./types";

const FONT_SIDE_CHANNEL_REASONS = new Set<ReasonCode>([
  "sink.font_metric_side_channel",
  "css.container_query",
  "css.container_size_query",
  "css.keyframes_remote_sink",
  "css.font_generated_content_probe",
  "css.font_ligature_feature",
  "css.font_measurement_setup",
  "css.font_animation_chain",
  "css.font_import_chain",
]);

const DECLARATION_DATA_PROBE_REASONS = new Set<ReasonCode>([
  "css.value.attr_source",
  "css.value.conditional_if",
  "css.value.style_query",
]);

const SVG_REMOTE_RESOURCE_SINK_REASONS = new Set<ReasonCode>([
  "sink.svg_reference",
  "sink.svg_paint_remote",
  "sink.svg_resource_remote",
  "sink.svg_feimage_remote",
  "sink.svg_animate_remote",
]);


const CSS_FINGERPRINTING_REASONS = new Set<ReasonCode>([
  "privacy.css_fingerprinting.conditional_resource",
  "privacy.css_fingerprinting.media_query_signal",
  "privacy.css_fingerprinting.print_signal",
  "privacy.css_fingerprinting.page_rule_signal",
  "privacy.css_fingerprinting.supports_query_signal",
  "privacy.css_fingerprinting.container_query_signal",
  "privacy.css_fingerprinting.rendered_text_signal",
  "privacy.css_fingerprinting.pseudo_element_signal",
  "privacy.css_fingerprinting.layout_overflow_signal",
  "privacy.css_fingerprinting.scroll_signal",
  "privacy.css_fingerprinting.text_node_signal",
  "privacy.css_fingerprinting.browser_specific_text_signal",
]);

const ATTRIBUTE_PROBE_REASONS = new Set<ReasonCode>([
  "selector.attribute.prefix_match",
  "selector.attribute.substring_match",
  "selector.attribute.suffix_match",
]);

const PARTIAL_ANALYSIS_REASON_PREFIXES = [
  "stylesheet.",
  "frame.",
  "resource.svg_image_document",
  "analysis.skipped",
] as const;

export function findingHasReason(finding: Finding, reason: ReasonCode): boolean {
  return finding.reasons.includes(reason);
}

export function hasReasonPrefix(finding: Finding, prefix: string): boolean {
  return finding.reasons.some((reason) => reason.startsWith(prefix));
}

export function hasSinkReason(finding: Finding): boolean {
  return hasReasonPrefix(finding, "sink.");
}

export function hasFrameCoverageReason(finding: Finding): boolean {
  return hasReasonPrefix(finding, "frame.");
}

export function hasPartialAnalysisReason(finding: Finding): boolean {
  return finding.reasons.some((reason) => PARTIAL_ANALYSIS_REASON_PREFIXES.some((prefix) => reason.startsWith(prefix)));
}

export function hasSensitiveSelectorReason(finding: Finding): boolean {
  return finding.reasons.some((reason) => reason.startsWith("selector.attribute") || reason === "selector.hidden_input" || reason === "selector.form_control");
}

export function hasAttributeProbeReason(finding: Finding): boolean {
  return hasAnyReason(finding, ATTRIBUTE_PROBE_REASONS);
}

export function hasDeclarationDataProbeReason(finding: Finding): boolean {
  return hasAnyReason(finding, DECLARATION_DATA_PROBE_REASONS);
}

export function hasFontSideChannelReason(finding: Finding): boolean {
  return hasAnyReason(finding, FONT_SIDE_CHANNEL_REASONS);
}

export function hasSvgRemoteResourceSinkReason(finding: Finding): boolean {
  return hasAnyReason(finding, SVG_REMOTE_RESOURCE_SINK_REASONS);
}

export function hasCssFingerprintingReason(finding: Finding): boolean {
  return hasAnyReason(finding, CSS_FINGERPRINTING_REASONS);
}

export function hasHighConfidenceRenderedTextCssFingerprintingReason(finding: Finding): boolean {
  return findingHasReason(finding, "privacy.css_fingerprinting.rendered_text_signal")
    || findingHasReason(finding, "privacy.css_fingerprinting.text_node_signal")
    || findingHasReason(finding, "privacy.css_fingerprinting.browser_specific_text_signal");
}

function hasAnyReason(finding: Finding, reasons: ReadonlySet<ReasonCode>): boolean {
  return finding.reasons.some((reason) => reasons.has(reason));
}
