import { POLICY_LIMITS } from "../../shared/constants";
import type { SitePolicy } from "../../shared/types";
import { isPlainObject, normalizePolicy } from "./policyNormalization";

export function parseImportedSitePolicy(text: string): SitePolicy {
  if (byteLength(text) > POLICY_LIMITS.maxImportedSettingsBytes) {
    throw new Error(`Settings import exceeds ${POLICY_LIMITS.maxImportedSettingsBytes} bytes.`);
  }

  const parsed = JSON.parse(text) as unknown;
  if (!isPlainObject(parsed)) throw new Error("Settings import must be a JSON object.");
  return normalizePolicy(parsed as Partial<SitePolicy>);
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
  return value.length;
}
