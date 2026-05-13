import type { AnalysisSummary, ExtensionMode, Finding, SitePolicy } from "../../shared/types";
import { shouldSanitize } from "../../core/policy/mode";

const STYLE_ELEMENT_ID = "css-sentry-neutralization-rules";
const CONTENT_NEUTRALIZATION_PROPERTIES = new Set([
  "background",
  "background-image",
  "border-image",
  "border-image-source",
  "list-style",
  "list-style-image",
  "cursor",
  "content",
  "mask",
  "mask-image",
  "-webkit-mask",
  "-webkit-mask-image",
  "clip-path",
  "filter",
  "fill",
  "stroke",
  "marker",
  "marker-start",
  "marker-mid",
  "marker-end",
]);

const PAGE_CHANGING_ACTIONS = new Set<Finding["action"]>([
  "blocked_dnr",
  "blocked_strict_third_party",
  "neutralized",
  "disabled_stylesheet",
  "removed_style_node",
]);

export interface NeutralizationResult {
  summary: AnalysisSummary;
  ruleCount: number;
}

export function applyContentNeutralization(documentRef: Document, summary: AnalysisSummary, policy: SitePolicy, mode: ExtensionMode): NeutralizationResult {
  if (!policy.compatibility.enableContentNeutralization || !shouldSanitize(mode)) {
    clearNeutralizationStyle(documentRef);
    return { summary, ruleCount: 0 };
  }

  const rules = new Map<string, string>();
  const neutralizedIds = new Set<string>();

  for (const finding of summary.findings) {
    const rule = neutralizationRuleForFinding(finding);
    if (!rule) continue;
    rules.set(rule.key, rule.cssText);
    neutralizedIds.add(finding.id);
  }

  installNeutralizationStyle(documentRef, [...rules.values()]);

  if (neutralizedIds.size === 0) return { summary, ruleCount: 0 };

  return {
    summary: {
      ...summary,
      findings: summary.findings.map((finding) => neutralizedIds.has(finding.id) && !PAGE_CHANGING_ACTIONS.has(finding.action)
        ? { ...finding, action: "neutralized" }
        : finding),
    },
    ruleCount: rules.size,
  };
}

export function neutralizationRuleForFinding(finding: Finding): { key: string; cssText: string } | null {
  if (!isContentNeutralizationCandidate(finding)) return null;
  const selector = rawNeutralizationSelector(finding)?.trim();
  const property = finding.property?.trim().toLowerCase();
  if (!selector || !property) return null;
  if (selector.includes("[redacted]") || selector.includes("[...") || selector.length > 600) return null;
  const safeValue = neutralValueForProperty(property);
  if (!safeValue) return null;
  return {
    key: `${selector}\n${property}`,
    cssText: `${selector}{${property}:${safeValue} !important;}`,
  };
}

function rawNeutralizationSelector(finding: Finding): string | null {
  const raw = (finding as Finding & { __cssSentryRawSelector?: string }).__cssSentryRawSelector;
  return typeof raw === "string" && raw.trim() ? raw : finding.selector;
}

function isContentNeutralizationCandidate(finding: Finding): boolean {
  if (!(finding.severity === "high" || finding.severity === "critical")) return false;
  if (!finding.destinationUrl && !finding.destinationOrigin) return false;
  if (!finding.selector || !finding.property) return false;
  const property = finding.property.toLowerCase();
  if (!CONTENT_NEUTRALIZATION_PROPERTIES.has(property)) return false;
  if (!finding.reasons.some((reason) => reason.startsWith("sink."))) return false;

  const hasDataProbe = finding.reasons.some((reason) =>
    reason.startsWith("selector.attribute")
    || reason === "selector.hidden_input"
    || reason === "selector.form_control"
    || reason === "css.value.attr_source"
    || reason === "css.value.conditional_if"
    || reason === "css.value.style_query"
    || reason === "sink.font_metric_side_channel"
    || reason === "css.font_generated_content_probe"
    || reason === "css.font_ligature_feature"
    || reason === "css.font_animation_chain"
    || reason === "css.font_import_chain"
  );

  return hasDataProbe;
}

function neutralValueForProperty(property: string): string | null {
  if (property === "cursor") return "auto";
  if (property === "content") return "normal";
  if (property === "fill" || property === "stroke") return "currentColor";
  if (property.startsWith("marker")) return "none";
  if (property === "filter" || property === "clip-path") return "none";
  return "none";
}

function installNeutralizationStyle(documentRef: Document, rules: string[]): void {
  const existing = documentRef.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (rules.length === 0) {
    existing?.remove();
    return;
  }

  const cssText = rules.join("\n");
  if (existing) {
    if (existing.textContent !== cssText) existing.textContent = cssText;
    return;
  }

  const style = documentRef.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.setAttribute("data-css-sentry", "content-neutralization");
  style.textContent = cssText;
  (documentRef.head ?? documentRef.documentElement).appendChild(style);
}

function clearNeutralizationStyle(documentRef: Document): void {
  documentRef.getElementById(STYLE_ELEMENT_ID)?.remove();
}
