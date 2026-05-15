import { describe, expect, it, vi } from "vitest";
import { selectBadgeActionApi } from "../../../src/browser/platform/actionApi";

describe("browser action API selection", () => {
  it("prefers MV3 action when it is available", () => {
    const action = { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() };
    const browserAction = { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() };

    expect(selectBadgeActionApi({ action, browserAction })).toBe(action);
  });

  it("falls back to Firefox MV2 browserAction when action is unavailable", () => {
    const browserAction = { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() };

    expect(selectBadgeActionApi({ browserAction })).toBe(browserAction);
  });

  it("returns null when neither badge API is complete", () => {
    expect(selectBadgeActionApi({ action: { setBadgeText: vi.fn() } })).toBeNull();
    expect(selectBadgeActionApi({})).toBeNull();
  });
});
