import { browser } from "wxt/browser";
import { STORAGE_KEYS } from "../../shared/constants";
import type { SitePolicy } from "../../shared/types";
import { normalizePolicy } from "./policyNormalization";

export async function getSitePolicy(): Promise<SitePolicy> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.settings);
  return normalizePolicy(stored[STORAGE_KEYS.settings] as Partial<SitePolicy> | undefined);
}

export async function persistSitePolicy(policy: SitePolicy): Promise<SitePolicy> {
  const normalizedPolicy = normalizePolicy(policy);
  await browser.storage.local.set({ [STORAGE_KEYS.settings]: normalizedPolicy });
  return normalizedPolicy;
}
