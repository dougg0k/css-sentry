import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTooltipDisclosure } from "../../../src/shared/hooks/useTooltipDisclosure";

function TooltipDisclosureProbe() {
  const { open, openTooltip, closeTooltip, scheduleClose } = useTooltipDisclosure({ closeDelayMs: 80 });
  return <div>
    <span data-testid="state">{open ? "open" : "closed"}</span>
    <button type="button" onClick={openTooltip}>Open</button>
    <button type="button" onClick={scheduleClose}>Schedule close</button>
    <button type="button" onClick={closeTooltip}>Close</button>
  </div>;
}

describe("useTooltipDisclosure", () => {
  it("keeps tooltip opening immediate and applies only the configured delayed close", () => {
    vi.useFakeTimers();
    try {
      render(<TooltipDisclosureProbe />);
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      expect(screen.getByTestId("state")).toHaveTextContent("open");

      fireEvent.click(screen.getByRole("button", { name: "Schedule close" }));
      act(() => { vi.advanceTimersByTime(79); });
      expect(screen.getByTestId("state")).toHaveTextContent("open");

      act(() => { vi.advanceTimersByTime(1); });
      expect(screen.getByTestId("state")).toHaveTextContent("closed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels delayed close on reopen and clears timers on unmount", () => {
    vi.useFakeTimers();
    try {
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
      const { unmount } = render(<TooltipDisclosureProbe />);

      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      fireEvent.click(screen.getByRole("button", { name: "Schedule close" }));
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      act(() => { vi.advanceTimersByTime(80); });
      expect(screen.getByTestId("state")).toHaveTextContent("open");
      expect(clearTimeoutSpy).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Schedule close" }));
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
