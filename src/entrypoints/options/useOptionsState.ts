import { useEffect, useState } from "react";
import { getDnrStatus } from "../../browser/dnr/chromeDnr";
import { getSitePolicy, normalizePolicy, saveSitePolicy } from "../../browser/storage/reports";
import type { DnrStatus, SitePolicy } from "../../shared/types";
import { useTransientValue } from "../../shared/hooks/useTransientValue";

const SAVED_NOTICE_MS = 1_400;

export interface OptionsStateController {
  policy: SitePolicy | null;
  saved: boolean;
  dnrStatus: DnrStatus | null;
  updatePolicy(nextPolicy: SitePolicy): Promise<void>;
}

export function useOptionsState(): OptionsStateController {
  const [policy, setPolicy] = useState<SitePolicy | null>(null);
  const [dnrStatus, setDnrStatus] = useState<DnrStatus | null>(null);
  const [saved, showSaved] = useTransientValue(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getSitePolicy(), getDnrStatus()]).then(([nextPolicy, nextDnrStatus]) => {
      if (!active) return;
      setPolicy(nextPolicy);
      setDnrStatus(nextDnrStatus);
    });
    return () => { active = false; };
  }, []);

  async function updatePolicy(nextPolicy: SitePolicy): Promise<void> {
    const normalizedPolicy = normalizePolicy(nextPolicy);
    setPolicy(normalizedPolicy);
    await saveSitePolicy(normalizedPolicy);
    showSaved(true, SAVED_NOTICE_MS);
  }

  return { policy, saved, dnrStatus, updatePolicy };
}
