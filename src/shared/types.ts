export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type ExtensionMode =
  | "default"
  | "passive"
  | "balanced"
  | "strict"
  | "always_scan_never_sanitize"
  | "never_scan_never_sanitize"
  | "paused"
  | "trusted";

export type AnalysisState =
  | "analysis.complete"
  | "analysis.partial"
  | "stylesheet.pending"
  | "stylesheet.cross_origin_uninspectable"
  | "stylesheet.failed_permission"
  | "stylesheet.failed_csp_or_platform"
  | "frame.cross_origin_uninspectable"
  | "svg.image_document.uninspectable"
  | "analysis.skipped.too_large"
  | "analysis.skipped.performance_budget";

export type MitigationAction =
  | "none"
  | "logged"
  | "warned"
  | "neutralized"
  | "blocked_dnr"
  | "rule_installed_dnr"
  | "future_blocked_dnr"
  | "blocked_strict_third_party"
  | "disabled_stylesheet"
  | "removed_style_node";

export type SourceKind =
  | "style_element"
  | "stylesheet"
  | "inline_style"
  | "import_rule"
  | "font_face"
  | "frame"
  | "html_attribute"
  | "svg_attribute"
  | "svg_image_resource"
  | "stylesheet_link"
  | "unknown";

export type ReasonCode =
  | "selector.attribute.prefix_match"
  | "selector.attribute.suffix_match"
  | "selector.attribute.substring_match"
  | "selector.attribute.exact_match"
  | "selector.attribute.sensitive_name"
  | "selector.form_control"
  | "selector.hidden_input"
  | "selector.relational.has"
  | "selector.repeated_probe_pattern"
  | "sink.remote_url"
  | "sink.import_remote"
  | "sink.image_set_remote"
  | "sink.font_remote"
  | "sink.font_unicode_range_remote"
  | "sink.font_metric_side_channel"
  | "css.font_ligature_feature"
  | "css.font_generated_content_probe"
  | "css.font_measurement_setup"
  | "css.font_animation_chain"
  | "css.font_import_chain"
  | "css.container_size_query"
  | "sink.svg_reference"
  | "sink.svg_paint_remote"
  | "sink.svg_resource_remote"
  | "sink.inline_remote_url"
  | "sink.html_body_background"
  | "sink.svg_feimage_remote"
  | "sink.svg_animate_remote"
  | "sink.stylesheet_link_remote"
  | "source.data_stylesheet"
  | "css.fixed_position.important"
  | "css.value.attr_source"
  | "css.value.conditional_if"
  | "css.value.style_query"
  | "css.container_query"
  | "css.keyframes_remote_sink"
  | "url.cross_origin"
  | "url.remote"
  | "url.high_entropy"
  | "url.local_network"
  | "css.custom_property.unresolved"
  | "css.custom_property.url_sink"
  | "css.grouping_rule.nested"
  | "stylesheet.cross_origin.uninspectable"
  | "stylesheet.pending"
  | "stylesheet.failed_permission"
  | "frame.cross_origin.uninspectable"
  | "resource.svg_image_document.uninspectable"
  | "policy.strict.third_party_stylesheet"
  | "policy.strict.svg_image_document"
  | "analysis.skipped.too_large"
  | "analysis.skipped.performance_budget";

export interface CssUrlAnalysis {
  raw: string;
  unquoted: string;
  normalized: string | null;
  scheme: string | null;
  origin: string | null;
  isRemote: boolean;
  isCrossOrigin: boolean;
  isData: boolean;
  isSafeDataUrl: boolean;
  isSvgReference: boolean;
  isImageSet: boolean;
  isHighEntropy: boolean;
  isLocalNetwork: boolean;
}

export interface DeclarationInfo {
  property: string;
  value: string;
  resolvedValue: string;
  urls: CssUrlAnalysis[];
  usesUnresolvedVar: boolean;
  unresolvedVars: string[];
  usesCustomPropertyUrl: boolean;
  usesFontUnicodeRange?: boolean;
  usesAttributeSource?: boolean;
  attributeSources?: string[];
  usesConditionalIf?: boolean;
  usesStyleQuery?: boolean;
}


export interface AttributeSelectorInfo {
  name: string;
  operator: "=" | "~=" | "|=" | "^=" | "$=" | "*=" | null;
  value: string | null;
  flags: string | null;
}

export interface SelectorAnalysis {
  selector: string;
  score: number;
  reasons: ReasonCode[];
  attributes: AttributeSelectorInfo[];
  isSensitive: boolean;
}

export interface RuleContext {
  sourceKind: SourceKind;
  sourceUrl: string | null;
  pageUrl: string;
  frameUrl: string | null;
  atRuleStack: string[];
}

export interface ParsedCssRule {
  type: "style" | "font-face" | "import";
  selector: string;
  declarationsText: string;
  importValue?: string;
  context: RuleContext;
}

export interface Finding {
  id: string;
  severity: Severity;
  confidence: number;
  pageUrl: string;
  pageOrigin: string | null;
  frameUrl: string | null;
  frameOrigin: string | null;
  sourceKind: SourceKind;
  sourceUrl: string | null;
  sourceOrigin: string | null;
  selector: string | null;
  property: string | null;
  destinationOrigin: string | null;
  destinationUrl: string | null;
  requestUrl?: string | null;
  action: MitigationAction;
  additionalActions?: MitigationAction[];
  state: AnalysisState;
  reasons: ReasonCode[];
  timestamp: number;
  details: string;
}

export interface AnalysisSummary {
  state: AnalysisState;
  findings: Finding[];
  analyzedStylesheets: number;
  partialStylesheets: number;
  analyzedFrames: number;
  partialFrames: number;
  startedAt: number;
  finishedAt: number;
}

export interface CompatibilitySettings {
  enableDnrMitigation: boolean;
  enableStrictThirdPartyBlocking: boolean;
  showPartialAnalysisFindings: boolean;
  enableFirefoxEnhancedMode: boolean;
  reportExternalSvgImageDocuments: boolean;
  enableSvgImageDnrPolicy: boolean;
  enableContentNeutralization: boolean;
}

export interface SitePolicy {
  mode: ExtensionMode;
  advancedModeEnabled: boolean;
  trustedOrigins: string[];
  blockedOrigins: string[];
  strictOrigins: string[];
  allowlistedOrigins: string[];
  blocklistedOrigins: string[];
  perOriginModes: Record<string, ExtensionMode>;
  logRetentionDays: number;
  compatibility: CompatibilitySettings;
}

export interface FrameReport {
  frameId: number;
  frameUrl: string;
  frameOrigin: string | null;
  parentFrameId: number;
  summary: AnalysisSummary;
  updatedAt: number;
}

export interface StoredTabReport {
  tabId: number;
  url: string;
  origin: string | null;
  summary: AnalysisSummary;
  frames: FrameReport[];
  updatedAt: number;
}

export interface DnrStatus {
  ok: boolean;
  operation: string;
  scope: "global" | "tab" | "finding" | "clear" | "unsupported";
  ruleCount: number;
  message: string;
  updatedAt: number;
  skippedTargetCount?: number;
  skippedTargetReasons?: Record<string, number>;
}

export interface ScanCompleteMessage {
  type: "css-sentry:scan-complete";
  url: string;
  summary: AnalysisSummary;
}

export interface PolicyUpdateMessage {
  type: "css-sentry:set-origin-mode";
  origin: string;
  mode: ExtensionMode;
}

export interface ClearReportMessage {
  type: "css-sentry:clear-current-report";
  tabId: number;
}

export interface PolicyUpdatedMessage {
  type: "css-sentry:policy-updated";
}

export type RuntimeMessage = ScanCompleteMessage | PolicyUpdateMessage | ClearReportMessage | PolicyUpdatedMessage;
