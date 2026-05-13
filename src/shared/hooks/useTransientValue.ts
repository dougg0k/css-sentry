import { useCallback, useEffect, useRef, useState } from "react";

type TimeoutHandle = number;

export function useTransientValue<T>(initialValue: T): readonly [T, (nextValue: T, durationMs: number) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue);
  const timerRef = useRef<TimeoutHandle | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const clearValue = useCallback(() => {
    clearTimer();
    setValue(initialValue);
  }, [clearTimer, initialValue]);

  const setTransientValue = useCallback((nextValue: T, durationMs: number) => {
    clearTimer();
    setValue(nextValue);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setValue(initialValue);
    }, durationMs);
  }, [clearTimer, initialValue]);

  useEffect(() => clearTimer, [clearTimer]);

  return [value, setTransientValue, clearValue] as const;
}
