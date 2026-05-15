import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_POLICY } from "../../../src/shared/constants";
import {
  policyWithAddedOrigin,
  policyWithAdvancedMode,
  policyWithCompatibilityFlag,
  policyWithOriginModeOverride,
  policyWithRemovedOrigin,
  policyWithoutOriginModeOverride,
} from "../../../src/entrypoints/options/optionsPolicyActions";

describe("options policy actions", () => {
  it("adds normalized origins and keeps allow/block destination lists mutually exclusive", () => {
    const base = { ...DEFAULT_SITE_POLICY, blocklistedOrigins: ["https://example.test"] };
    const result = policyWithAddedOrigin(base, "allowlistedOrigins", "example.test");

    expect(result?.policy.allowlistedOrigins).toEqual(["https://example.test"]);
    expect(result?.policy.blocklistedOrigins).toEqual([]);
  });

  it("ignores invalid origin input without mutating the policy", () => {
    expect(policyWithAddedOrigin(DEFAULT_SITE_POLICY, "trustedOrigins", "null")).toBeNull();
  });

  it("removes origins and exact per-origin overrides through policy authorities", () => {
    const added = policyWithOriginModeOverride(DEFAULT_SITE_POLICY, { origin: "https://app.example", mode: "strict" });
    expect(added?.policy.perOriginModes).toMatchObject({ "https://app.example": "strict" });
    expect(added?.policy.strictOrigins).toEqual(["https://app.example"]);

    const removedList = policyWithRemovedOrigin(added!.policy, "strictOrigins", "https://app.example");
    expect(removedList.strictOrigins).toEqual([]);

    const removedOverride = policyWithoutOriginModeOverride(added!.policy, "https://app.example");
    expect(removedOverride.perOriginModes["https://app.example"]).toBeUndefined();
  });

  it("updates advanced mode and compatibility flags without touching unrelated settings", () => {
    const advanced = policyWithAdvancedMode(DEFAULT_SITE_POLICY, true);
    expect(advanced.advancedModeEnabled).toBe(true);
    expect(advanced.mode).toBe(DEFAULT_SITE_POLICY.mode);

    const compatibility = policyWithCompatibilityFlag(DEFAULT_SITE_POLICY, "enableContentNeutralization", false);
    expect(compatibility.compatibility.enableContentNeutralization).toBe(false);
    expect(compatibility.compatibility.enableDnrMitigation).toBe(DEFAULT_SITE_POLICY.compatibility.enableDnrMitigation);

    const fingerprintingGuard = policyWithCompatibilityFlag(DEFAULT_SITE_POLICY, "enableCssFingerprintingGuard", true);
    expect(fingerprintingGuard.compatibility.enableCssFingerprintingGuard).toBe(true);
    expect(fingerprintingGuard.compatibility.enableContentNeutralization).toBe(DEFAULT_SITE_POLICY.compatibility.enableContentNeutralization);
  });
});
