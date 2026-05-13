import { describe, expect, it } from "vitest";
import { mountReactRoot } from "../../../src/shared/mountReactRoot";

describe("mountReactRoot", () => {
  it("throws a clear boundary error when the UI root is missing", () => {
    expect(() => mountReactRoot("missing-root", <span />)).toThrow("CSS Sentry UI root #missing-root was not found.");
  });
});
