import type { CompatibilitySettings, ExtensionMode, SitePolicy } from "./types";

export interface ModeDefinition {
  mode: ExtensionMode;
  label: string;
  shortLabel: string;
  summary: string;
  details: string;
  recommendedUse: string;
  prominent: boolean;
}

export const MODE_DEFINITIONS: ModeDefinition[] = [
  {
    mode: "default",
    label: "Inherit global mode",
    shortLabel: "Inherit",
    summary: "Follow the global protection mode.",
    details: "Clears the site-specific override so this origin follows the shared protection mode configured in Options or the popup.",
    recommendedUse: "Use when a site-specific rule is no longer needed.",
    prominent: true
  },
  {
    mode: "passive",
    label: "Passive",
    shortLabel: "Passive",
    summary: "Detect and record findings only.",
    details: "Scans CSS and stores local findings, but avoids blocking or sanitizing. This is safest for testing and for pages where breakage is unacceptable.",
    recommendedUse: "Testing, auditing, and false-positive review.",
    prominent: true
  },
  {
    mode: "balanced",
    label: "Balanced",
    shortLabel: "Balanced",
    summary: "Warn and mitigate high-confidence exfiltration attempts.",
    details: "Scans CSS, records findings, and installs precise network rules for high-confidence CSS exfiltration shapes, including same-origin value-probing sinks. Finding-derived rules protect matching future requests; destination-policy rules can block before analysis.",
    recommendedUse: "General browsing once the extension is stable.",
    prominent: true
  },
  {
    mode: "strict",
    label: "Strict",
    shortLabel: "Strict",
    summary: "Use stronger blocking on sensitive sites.",
    details: "Includes Balanced high-confidence mitigation and adds stronger blocking for suspicious CSS and optional third-party CSS-triggered resources. This offers more protection for sensitive sites, but it can break complex pages.",
    recommendedUse: "Webmail, banking, admin panels, cloud consoles, identity providers, and other sensitive sites.",
    prominent: true
  },
  {
    mode: "trusted",
    label: "Trusted",
    shortLabel: "Trusted",
    summary: "Do not scan or mitigate this origin.",
    details: "Marks the origin as trusted. CSS Sentry does not scan or block on that site. Use sparingly because it disables protection there.",
    recommendedUse: "Sites you fully trust or sites where the extension causes unacceptable false positives.",
    prominent: true
  },
  {
    mode: "paused",
    label: "Paused",
    shortLabel: "Paused",
    summary: "Temporarily disable protection for this origin.",
    details: "Stops scanning and mitigation for the origin without implying that the site is permanently trusted.",
    recommendedUse: "Troubleshooting temporary site breakage.",
    prominent: true
  },
  {
    mode: "always_scan_never_sanitize",
    label: "Always scan / never sanitize",
    shortLabel: "Scan only",
    summary: "Always scan, but never alter or block the page.",
    details: "Forces scan/report behavior while disabling mitigation. Useful for security review when you need findings but no page modification.",
    recommendedUse: "Debugging, compatibility testing, and audit-only workflows.",
    prominent: false
  },
  {
    mode: "never_scan_never_sanitize",
    label: "Never scan / never sanitize",
    shortLabel: "Never scan",
    summary: "Completely disable CSS Sentry for this origin.",
    details: "Skips scanning, logging, and mitigation for this origin. Prefer Paused for temporary troubleshooting and Trusted for permanent allow decisions.",
    recommendedUse: "Origins where scanning itself is undesirable or unsupported.",
    prominent: false
  }
];

export const GLOBAL_MODE_ORDER: ExtensionMode[] = ["passive", "balanced", "strict"];
export const ADVANCED_GLOBAL_MODE_ORDER: ExtensionMode[] = ["passive", "balanced", "strict", "always_scan_never_sanitize", "never_scan_never_sanitize"];
export const ADVANCED_SETTINGS_GLOBAL_MODE_ORDER: ExtensionMode[] = ["passive", "balanced", "strict", "trusted", "paused", "always_scan_never_sanitize", "never_scan_never_sanitize"];
export const STANDARD_ORIGIN_MODE_ORDER: ExtensionMode[] = ["default", "passive", "balanced", "strict", "trusted", "paused"];
export const ORIGIN_MODE_ORDER: ExtensionMode[] = ["default", "passive", "balanced", "strict", "trusted", "paused", "always_scan_never_sanitize", "never_scan_never_sanitize"];

export const ADVANCED_MODE_EXPLANATION = "Advanced mode reveals low-level site rules, destination allow/block lists, optional compatibility features, and scan-only or never-scan modes. Keep it off for normal use; enable it when debugging, testing, or intentionally configuring edge-case behavior.";

export function getModeDefinition(mode: ExtensionMode): ModeDefinition {
  return MODE_DEFINITIONS.find((definition) => definition.mode === mode) ?? MODE_DEFINITIONS[1];
}

export interface OriginListDefinition {
  key: keyof Pick<SitePolicy, "trustedOrigins" | "blockedOrigins" | "strictOrigins" | "allowlistedOrigins" | "blocklistedOrigins">;
  label: string;
  summary: string;
  tooltip: string;
  requiredForMostUsers: boolean;
}

export const ORIGIN_LIST_DEFINITIONS: OriginListDefinition[] = [
  {
    key: "strictOrigins",
    label: "Strict origins",
    summary: "Sites that should always use Strict mode.",
    tooltip: "Use this for sensitive sites such as webmail, banking, admin panels, identity providers, and cloud consoles. Strict mode may break pages because it blocks more aggressively.",
    requiredForMostUsers: true
  },
  {
    key: "trustedOrigins",
    label: "Trusted origins",
    summary: "Sites where CSS Sentry should stay out of the way.",
    tooltip: "Trusted origins are not scanned or mitigated. Use only when you accept the risk or need a permanent compatibility exception.",
    requiredForMostUsers: true
  },
  {
    key: "blockedOrigins",
    label: "Never-scan origins",
    summary: "Sites where scanning and mitigation are fully disabled.",
    tooltip: "This is a stronger compatibility bypass than Trusted. Use for sites where even detection causes problems or where scanning is not useful.",
    requiredForMostUsers: false
  },
  {
    key: "allowlistedOrigins",
    label: "Allowed destination origins",
    summary: "Network destinations allowed during mitigation decisions.",
    tooltip: "Advanced control for resource destinations. Use for known-good asset origins that should not be blocked in strict or balanced workflows.",
    requiredForMostUsers: false
  },
  {
    key: "blocklistedOrigins",
    label: "Blocked destination origins",
    summary: "Network destinations that should be treated as hostile.",
    tooltip: "Advanced control for resource destinations. Add origins that should be blocked when CSS Sentry mitigation is active.",
    requiredForMostUsers: false
  }
];

export interface CompatibilityDefinition {
  key: keyof CompatibilitySettings;
  label: string;
  summary: string;
  tooltip: string;
  recommendedValue: boolean;
  advanced: boolean;
}

export const COMPATIBILITY_DEFINITIONS: CompatibilityDefinition[] = [
  {
    key: "enableDnrMitigation",
    label: "Enable declarative network blocking",
    summary: "Allow browser network rules for high-confidence findings.",
    tooltip: "Recommended on. CSS Sentry uses scoped network rules for high-confidence mitigation decisions. Finding-derived rules are installed after analysis for later matching requests; destination-policy rules can be active before analysis.",
    recommendedValue: true,
    advanced: false
  },

  {
    key: "enableContentNeutralization",
    label: "Enable content-level CSS neutralization",
    summary: "Override confirmed high-confidence CSS exfil declarations on the page.",
    tooltip: "Recommended on. CSS Sentry can inject precise override rules for confirmed high-confidence CSS exfil findings so page-visible computed styles no longer keep dangerous request-producing declarations. This is limited to network-capable CSS properties with selector, declaration, or font-side-channel evidence and can be disabled if a site has a compatibility issue.",
    recommendedValue: true,
    advanced: false
  },
  {
    key: "enableStrictThirdPartyBlocking",
    label: "Enable strict third-party resource blocking",
    summary: "Allow Strict mode to block third-party CSS-triggered resources.",
    tooltip: "Recommended on for Strict mode. This can improve protection on sensitive sites but may break pages that rely on third-party images, fonts, or stylesheets.",
    recommendedValue: true,
    advanced: false
  },
  {
    key: "showPartialAnalysisFindings",
    label: "Show partial-analysis findings",
    summary: "Show stored stylesheet and frame coverage finding rows in popup and report views.",
    tooltip: "Recommended off for normal browsing if you want fewer coverage rows. Analysis state, partial frame counts, and partial stylesheet counts remain visible even when these informational rows are hidden.",
    recommendedValue: false,
    advanced: false
  },
  {
    key: "enableFirefoxEnhancedMode",
    label: "Enable Firefox enhanced stylesheet response inspection",
    summary: "Use Firefox response-filter APIs, when available, to inspect stylesheet responses without making extension-origin fetches.",
    tooltip: "Recommended off. In Firefox builds that expose filterResponseData, CSS Sentry can observe stylesheet response bodies for reporting while passing the original response through unchanged. This adds Firefox-specific permissions, code paths, and testing requirements; Chrome MV3 ignores this option because the required API is not available.",
    recommendedValue: false,
    advanced: true
  },
  {
    key: "reportExternalSvgImageDocuments",
    label: "Report external SVG image documents as partial coverage",
    summary: "Record externally loaded SVG image resources that cannot be inspected as DOM documents.",
    tooltip: "Recommended off for normal use. Inline SVG <style> is already scanned, but SVG loaded through img, object, embed, or SVG image elements may not expose its internal CSS/DOM to a content script. Enabling this reports those resources as partial coverage instead of claiming they were inspected.",
    recommendedValue: false,
    advanced: true
  },
  {
    key: "enableSvgImageDnrPolicy",
    label: "Apply Strict SVG image-document network policy",
    summary: "Allow Strict mode to block third-party SVG image-document resources with DNR.",
    tooltip: "Recommended off unless you want stricter protection on sensitive sites. This can block third-party SVG icons, diagrams, sprites, or logos. Destination allowlists and blocklists still apply; full internal inspection of SVG image documents is not claimed.",
    recommendedValue: false,
    advanced: true
  }
];

export interface SummaryStatDefinition {
  key: "mode" | "severity" | "frames" | "partialSheets" | "findings" | "mitigated" | "blocked" | "futureRules" | "allowed" | "info" | "coverage";
  label: string;
  tooltip: string;
}

export const SUMMARY_STAT_DEFINITIONS: Record<SummaryStatDefinition["key"], SummaryStatDefinition> = {
  mode: {
    key: "mode",
    label: "Mode",
    tooltip: "The global protection mode shared by the popup and Options page."
  },
  severity: {
    key: "severity",
    label: "Severity",
    tooltip: "The highest severity among actionable findings for the current tab. Info-only findings are not counted as risky."
  },
  frames: {
    key: "frames",
    label: "Frames",
    tooltip: "Analyzed frames divided by total known frames. A lower ratio means some frames could not be inspected or have not reported yet."
  },
  partialSheets: {
    key: "partialSheets",
    label: "Partial sheets",
    tooltip: "Stylesheets that could not be fully inspected because of browser restrictions, permissions, platform limits, or size/performance limits."
  },
  findings: {
    key: "findings",
    label: "Findings",
    tooltip: "Actionable CSS Sentry findings recorded for this tab, excluding informational coverage notes."
  },
  mitigated: {
    key: "mitigated",
    label: "Mitigated",
    tooltip: "Findings with either an already-applied prevention action or a precise DNR rule installed after analysis."
  },
  blocked: {
    key: "blocked",
    label: "Prevented",
    tooltip: "Findings where a pre-existing network rule or page-changing mitigation prevented or changed current page behavior on this load."
  },
  futureRules: {
    key: "futureRules",
    label: "Rules active",
    tooltip: "Findings where CSS Sentry installed precise DNR rules after analysis. Reloads and later matching requests are blocked, but these are not counted as already prevented."
  },
  allowed: {
    key: "allowed",
    label: "Logged only",
    tooltip: "Actionable findings that were logged for review but were not blocked or changed."
  },
  info: {
    key: "info",
    label: "Info only",
    tooltip: "Informational findings that do not indicate a risky CSS exfiltration pattern."
  },
  coverage: {
    key: "coverage",
    label: "Coverage",
    tooltip: "Informational notices for frames, stylesheets, SVG image documents, or large CSS that could not be fully inspected."
  }
};

export const LOGS_EXPLANATION = "Logs are local reports of what CSS Sentry detected, why it was risky, and what action was taken. They help explain blocks, debug false positives, and export safe diagnostics. They are stored locally and are not telemetry.";
