import type { ExtensionMode, SitePolicy } from "../../shared/types";
import { DEFAULT_SITE_POLICY } from "../../shared/constants";
import { getOrigin, normalizeOriginInput } from "../../shared/url";

function withoutOrigin(values: string[], origin: string): string[] {
  return values.filter((item) => item !== origin);
}

export function effectiveModeForUrl(url: string, policy: SitePolicy = DEFAULT_SITE_POLICY): ExtensionMode {
  const origin = getOrigin(url);
  if (!origin) return policy.mode;

  const explicitMode = policy.perOriginModes[origin];
  if (explicitMode) return explicitMode;
  if (policy.trustedOrigins.includes(origin)) return "trusted";
  if (policy.blockedOrigins.includes(origin)) return "never_scan_never_sanitize";
  if (policy.strictOrigins.includes(origin)) return "strict";

  return policy.mode;
}

export function setOriginMode(policy: SitePolicy, inputOrigin: string, mode: ExtensionMode): SitePolicy {
  const origin = normalizeOriginInput(inputOrigin);
  if (!origin) return { ...policy };

  const next: SitePolicy = {
    ...policy,
    trustedOrigins: withoutOrigin(policy.trustedOrigins, origin),
    blockedOrigins: withoutOrigin(policy.blockedOrigins, origin),
    strictOrigins: withoutOrigin(policy.strictOrigins, origin),
    perOriginModes: { ...policy.perOriginModes },
  };

  if (mode === "default") {
    delete next.perOriginModes[origin];
    return next;
  }

  next.perOriginModes[origin] = mode;

  if (mode === "trusted") next.trustedOrigins = [...new Set([...next.trustedOrigins, origin])].sort();
  if (mode === "strict") next.strictOrigins = [...new Set([...next.strictOrigins, origin])].sort();
  if (mode === "never_scan_never_sanitize") next.blockedOrigins = [...new Set([...next.blockedOrigins, origin])].sort();

  return next;
}

export function shouldScan(mode: ExtensionMode): boolean {
  return mode !== "paused" && mode !== "trusted" && mode !== "never_scan_never_sanitize";
}

export function shouldMitigate(mode: ExtensionMode): boolean {
  return mode === "balanced" || mode === "strict" || mode === "default";
}

export function shouldSanitize(mode: ExtensionMode): boolean {
  return mode !== "passive" && mode !== "always_scan_never_sanitize" && shouldScan(mode);
}

export function shouldStrictBlockThirdParty(mode: ExtensionMode): boolean {
  return mode === "strict";
}
