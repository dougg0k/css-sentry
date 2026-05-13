import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTransientValue } from "../../../src/shared/hooks/useTransientValue";

function TransientValueProbe() {
  const [value, setTransientValue, clearValue] = useTransientValue("idle");
  return <div>
    <span data-testid="value">{value}</span>
    <button type="button" onClick={() => setTransientValue("saved", 50)}>Save</button>
    <button type="button" onClick={clearValue}>Clear</button>
  </div>;
}

describe("useTransientValue", () => {
  it("sets a temporary value and restores the initial value after the duration", () => {
    vi.useFakeTimers();
    try {
      render(<TransientValueProbe />);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByTestId("value")).toHaveTextContent("saved");

      act(() => { vi.advanceTimersByTime(49); });
      expect(screen.getByTestId("value")).toHaveTextContent("saved");

      act(() => { vi.advanceTimersByTime(1); });
      expect(screen.getByTestId("value")).toHaveTextContent("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears pending timers on explicit clear and unmount", () => {
    vi.useFakeTimers();
    try {
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
      const { unmount } = render(<TransientValueProbe />);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect(screen.getByTestId("value")).toHaveTextContent("idle");
      expect(clearTimeoutSpy).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
