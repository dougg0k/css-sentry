import { DEFAULT_SITE_POLICY, POLICY_LIMITS } from "../../shared/constants";
import type { ExtensionMode, SitePolicy } from "../../shared/types";
import { isPolicyOrigin } from "../../shared/url";

const VALID_MODES = new Set<ExtensionMode>([
  "default",
  "passive",
  "balanced",
  "strict",
  "always_scan_never_sanitize",
  "never_scan_never_sanitize",
  "paused",
  "trusted",
]);

export function normalizePolicy(policy?: Partial<SitePolicy> | Record<string, unknown>): SitePolicy {
  const plainPolicy: Record<string, unknown> = isPlainObject(policy) ? policy : {};

  const perOriginModes = Object.fromEntries(
    Object.entries(isPlainObject(plainPolicy.perOriginModes) ? plainPolicy.perOriginModes : DEFAULT_SITE_POLICY.perOriginModes)
      .filter(([origin, mode]) => isPolicyOrigin(origin) && origin.length <= POLICY_LIMITS.maxOriginLength && typeof mode === "string" && mode !== "default" && VALID_MODES.has(mode as ExtensionMode))
      .slice(0, POLICY_LIMITS.maxPerOriginModes),
  ) as SitePolicy["perOriginModes"];

  const rawMode = typeof plainPolicy.mode === "string" && VALID_MODES.has(plainPolicy.mode as ExtensionMode) ? plainPolicy.mode as ExtensionMode : DEFAULT_SITE_POLICY.mode;
  const logRetentionDays = clampInteger(plainPolicy.logRetentionDays, DEFAULT_SITE_POLICY.logRetentionDays, POLICY_LIMITS.minLogRetentionDays, POLICY_LIMITS.maxLogRetentionDays);
  const compatibility = isPlainObject(plainPolicy.compatibility) ? plainPolicy.compatibility : {};
  const blocklistedOrigins = cleanOriginList(Array.isArray(plainPolicy.blocklistedOrigins) ? plainPolicy.blocklistedOrigins : DEFAULT_SITE_POLICY.blocklistedOrigins);
  const blocklistedOriginSet = new Set(blocklistedOrigins);
  const allowlistedOrigins = cleanOriginList(Array.isArray(plainPolicy.allowlistedOrigins) ? plainPolicy.allowlistedOrigins : DEFAULT_SITE_POLICY.allowlistedOrigins)
    .filter((origin) => !blocklistedOriginSet.has(origin));

  return {
    ...DEFAULT_SITE_POLICY,
    mode: rawMode,
    advancedModeEnabled: typeof plainPolicy.advancedModeEnabled === "boolean" ? plainPolicy.advancedModeEnabled : DEFAULT_SITE_POLICY.advancedModeEnabled,
    trustedOrigins: cleanOriginList(Array.isArray(plainPolicy.trustedOrigins) ? plainPolicy.trustedOrigins : DEFAULT_SITE_POLICY.trustedOrigins),
    blockedOrigins: cleanOriginList(Array.isArray(plainPolicy.blockedOrigins) ? plainPolicy.blockedOrigins : DEFAULT_SITE_POLICY.blockedOrigins),
    strictOrigins: cleanOriginList(Array.isArray(plainPolicy.strictOrigins) ? plainPolicy.strictOrigins : DEFAULT_SITE_POLICY.strictOrigins),
    allowlistedOrigins,
    blocklistedOrigins,
    perOriginModes,
    logRetentionDays,
    compatibility: {
      enableDnrMitigation: booleanOrDefault(compatibility.enableDnrMitigation, DEFAULT_SITE_POLICY.compatibility.enableDnrMitigation),
      enableStrictThirdPartyBlocking: booleanOrDefault(compatibility.enableStrictThirdPartyBlocking, DEFAULT_SITE_POLICY.compatibility.enableStrictThirdPartyBlocking),
      showPartialAnalysisFindings: booleanOrDefault(compatibility.showPartialAnalysisFindings, DEFAULT_SITE_POLICY.compatibility.showPartialAnalysisFindings),
      enableFirefoxEnhancedMode: booleanOrDefault(compatibility.enableFirefoxEnhancedMode, DEFAULT_SITE_POLICY.compatibility.enableFirefoxEnhancedMode),
      reportExternalSvgImageDocuments: booleanOrDefault(compatibility.reportExternalSvgImageDocuments, DEFAULT_SITE_POLICY.compatibility.reportExternalSvgImageDocuments),
      enableSvgImageDnrPolicy: booleanOrDefault(compatibility.enableSvgImageDnrPolicy, DEFAULT_SITE_POLICY.compatibility.enableSvgImageDnrPolicy),
      enableContentNeutralization: booleanOrDefault(compatibility.enableContentNeutralization, DEFAULT_SITE_POLICY.compatibility.enableContentNeutralization),
      enableCssFingerprintingGuard: booleanOrDefault(compatibility.enableCssFingerprintingGuard, DEFAULT_SITE_POLICY.compatibility.enableCssFingerprintingGuard),
    },
  };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cleanOriginList(values: readonly unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length <= POLICY_LIMITS.maxOriginLength && isPolicyOrigin(value)))]
    .slice(0, POLICY_LIMITS.maxOriginsPerList)
    .sort();
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}
