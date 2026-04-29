import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_POLICY } from "../../../src/shared/constants";
import { effectiveModeForUrl, setOriginMode, shouldMitigate, shouldScan, shouldStrictBlockThirdParty } from "../../../src/core/policy/mode";
import { normalizePolicy } from "../../../src/browser/storage/reports";

describe("site policy", () => {
  it("uses balanced as the default protection mode", () => {
    expect(DEFAULT_SITE_POLICY.mode).toBe("balanced");
    expect(effectiveModeForUrl("https://example.test/", DEFAULT_SITE_POLICY)).toBe("balanced");
  });

  it("resolves per-origin modes before global defaults", () => {
    const policy = setOriginMode(DEFAULT_SITE_POLICY, "https://bank.example", "strict");
    expect(effectiveModeForUrl("https://bank.example/login", policy)).toBe("strict");
  });

  it("rejects invalid null-like origins when setting or loading policy", () => {
    expect(setOriginMode(DEFAULT_SITE_POLICY, "null", "trusted").trustedOrigins).toEqual([]);
    expect(setOriginMode(DEFAULT_SITE_POLICY, "https://null", "trusted").trustedOrigins).toEqual([]);

    const normalized = normalizePolicy({
      trustedOrigins: ["https://null", "https://valid.example"],
      perOriginModes: { "https://null": "trusted", "https://valid.example": "strict" },
    });

    expect(normalized.trustedOrigins).toEqual(["https://valid.example"]);
    expect(normalized.perOriginModes).toEqual({ "https://valid.example": "strict" });
  });

  it("models scan and mitigation modes", () => {
    expect(shouldScan("trusted")).toBe(false);
    expect(shouldScan("paused")).toBe(false);
    expect(shouldScan("balanced")).toBe(true);
    expect(shouldMitigate("balanced")).toBe(true);
    expect(shouldStrictBlockThirdParty("strict")).toBe(true);
  });
});
