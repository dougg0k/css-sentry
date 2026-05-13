import { useCallback, useEffect, useRef, useState } from "react";

interface TooltipDisclosureOptions {
  closeDelayMs: number;
}

export interface TooltipDisclosure {
  readonly open: boolean;
  openTooltip(): void;
  closeTooltip(): void;
  scheduleClose(): void;
}

export function useTooltipDisclosure(options: TooltipDisclosureOptions): TooltipDisclosure {
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const openTooltip = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const closeTooltip = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, options.closeDelayMs);
  }, [clearCloseTimer, options.closeDelayMs]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  return { open, openTooltip, closeTooltip, scheduleClose };
}
