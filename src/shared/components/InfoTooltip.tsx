import { useId, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTooltipDisclosure } from "../hooks/useTooltipDisclosure";

const VIEWPORT_PADDING = 8;
const GAP = 8;
const FALLBACK_WIDTH = 280;
const TOOLTIP_POINTER_LEAVE_GRACE_MS = 80;

interface TooltipPosition {
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
}

export function InfoTooltip({ text }: { text: string }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const { open, openTooltip, closeTooltip, scheduleClose: schedulePointerClose } = useTooltipDisclosure({ closeDelayMs: TOOLTIP_POINTER_LEAVE_GRACE_MS });
  const [position, setPosition] = useState<TooltipPosition>(() => ({ left: VIEWPORT_PADDING, top: VIEWPORT_PADDING, maxWidth: FALLBACK_WIDTH, maxHeight: 160 }));

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const bubbleRect = bubbleRef.current?.getBoundingClientRect();
      const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      const maxWidth = Math.max(180, Math.min(FALLBACK_WIDTH, viewportWidth - VIEWPORT_PADDING * 2));
      const measuredWidth = Math.min(bubbleRect?.width ?? maxWidth, maxWidth);
      const measuredHeight = Math.min(bubbleRect?.height ?? 120, viewportHeight - VIEWPORT_PADDING * 2);
      const preferredTop = triggerRect.bottom + GAP;
      const flippedTop = triggerRect.top - measuredHeight - GAP;
      const hasRoomBelow = preferredTop + measuredHeight <= viewportHeight - VIEWPORT_PADDING;
      const top = clamp(hasRoomBelow ? preferredTop : flippedTop, VIEWPORT_PADDING, viewportHeight - VIEWPORT_PADDING - measuredHeight);
      const centeredLeft = triggerRect.left + triggerRect.width / 2 - measuredWidth / 2;
      const left = clamp(centeredLeft, VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING - measuredWidth);
      setPosition({ left, top, maxWidth, maxHeight: Math.max(80, viewportHeight - VIEWPORT_PADDING * 2) });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      closeTooltip();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTooltip();
    };
    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, closeTooltip]);

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="tooltipButton"
      aria-label={text}
      aria-describedby={open ? id : undefined}
      aria-expanded={open}
      onPointerEnter={openTooltip}
      onPointerLeave={schedulePointerClose}
      onMouseEnter={openTooltip}
      onMouseLeave={schedulePointerClose}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => { event.preventDefault(); openTooltip(); }}
      onFocus={openTooltip}
      onBlur={(event: FocusEvent<HTMLButtonElement>) => {
        const relatedTarget = event.relatedTarget as Node | null;
        if (relatedTarget && bubbleRef.current?.contains(relatedTarget)) return;
        schedulePointerClose();
      }}
    >?</button>
    {open ? createPortal(
      <div
        id={id}
        ref={bubbleRef}
        role="tooltip"
        className="tooltipBubble"
        style={{ left: position.left, top: position.top, maxWidth: position.maxWidth, maxHeight: position.maxHeight }}
        tabIndex={-1}
        onPointerEnter={openTooltip}
        onPointerLeave={schedulePointerClose}
        onMouseEnter={openTooltip}
        onMouseLeave={schedulePointerClose}
      >{text}</div>,
      document.body,
    ) : null}
  </>;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}
