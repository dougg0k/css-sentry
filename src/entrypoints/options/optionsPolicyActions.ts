import type { CompatibilitySettings, ExtensionMode, SitePolicy } from "../../shared/types";
import { normalizeOriginInput } from "../../shared/url";
import { setOriginMode } from "../../core/policy/mode";
import type { OriginListKey } from "./components";

export type OriginModeDraft = {
  origin: string;
  mode: ExtensionMode;
};

export type OriginListActionResult = {
  policy: SitePolicy;
  origin: string;
} | null;

export function policyWithAddedOrigin(policy: SitePolicy, list: OriginListKey, rawOrigin: string | null | undefined): OriginListActionResult {
  const origin = normalizeOriginInput(rawOrigin);
  if (!origin) return null;

  const values = new Set([...(policy[list] as string[]), origin]);
  const nextPolicy: SitePolicy = { ...policy, [list]: [...values].sort() };

  if (list === "allowlistedOrigins") nextPolicy.blocklistedOrigins = policy.blocklistedOrigins.filter((item) => item !== origin);
  if (list === "blocklistedOrigins") nextPolicy.allowlistedOrigins = policy.allowlistedOrigins.filter((item) => item !== origin);

  return { policy: nextPolicy, origin };
}

export function policyWithRemovedOrigin(policy: SitePolicy, list: OriginListKey, origin: string): SitePolicy {
  return { ...policy, [list]: (policy[list] as string[]).filter((item) => item !== origin) };
}

export function policyWithCompatibilityFlag(policy: SitePolicy, key: keyof CompatibilitySettings, enabled: boolean): SitePolicy {
  return { ...policy, compatibility: { ...policy.compatibility, [key]: enabled } };
}

export function policyWithAdvancedMode(policy: SitePolicy, enabled: boolean): SitePolicy {
  return { ...policy, advancedModeEnabled: enabled };
}

export function policyWithOriginModeOverride(policy: SitePolicy, draft: OriginModeDraft): OriginListActionResult {
  const origin = normalizeOriginInput(draft.origin);
  if (!origin) return null;
  return { policy: setOriginMode(policy, origin, draft.mode), origin };
}

export function policyWithoutOriginModeOverride(policy: SitePolicy, origin: string): SitePolicy {
  return setOriginMode(policy, origin, "default");
}
