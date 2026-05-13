import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_POLICY, POLICY_LIMITS } from "../../../src/shared/constants";
import { normalizePolicy } from "../../../src/browser/storage/policyNormalization";

describe("policy normalization", () => {
  it("normalizes supported modes, origins, compatibility flags, and retention limits", () => {
    const normalized = normalizePolicy({
      mode: "strict",
      advancedModeEnabled: true,
      logRetentionDays: 10_000,
      trustedOrigins: ["https://trusted.example", "javascript:alert(1)", "https://trusted.example"],
      blockedOrigins: ["https://blocked.example", "ftp://blocked.example"],
      strictOrigins: ["https://strict.example"],
      allowlistedOrigins: ["https://shared.example", "https://allow.example"],
      blocklistedOrigins: ["https://shared.example"],
      perOriginModes: {
        "https://trusted.example": "trusted",
        "https://ignored-default.example": "default",
        "https://bad-mode.example": "unsupported",
      },
      compatibility: {
        enableDnrMitigation: false,
        enableStrictThirdPartyBlocking: false,
        showPartialAnalysisFindings: true,
        enableFirefoxEnhancedMode: true,
        reportExternalSvgImageDocuments: true,
        enableSvgImageDnrPolicy: true,
        enableContentNeutralization: false,
        unsupportedFlag: true,
      },
    });

    expect(normalized.mode).toBe("strict");
    expect(normalized.advancedModeEnabled).toBe(true);
    expect(normalized.logRetentionDays).toBe(POLICY_LIMITS.maxLogRetentionDays);
    expect(normalized.trustedOrigins).toEqual(["https://trusted.example"]);
    expect(normalized.blockedOrigins).toEqual(["https://blocked.example"]);
    expect(normalized.strictOrigins).toEqual(["https://strict.example"]);
    expect(normalized.allowlistedOrigins).toEqual(["https://allow.example"]);
    expect(normalized.blocklistedOrigins).toEqual(["https://shared.example"]);
    expect(normalized.perOriginModes).toEqual({ "https://trusted.example": "trusted" });
    expect(normalized.compatibility).toEqual({
      enableDnrMitigation: false,
      enableStrictThirdPartyBlocking: false,
      showPartialAnalysisFindings: true,
      enableFirefoxEnhancedMode: true,
      reportExternalSvgImageDocuments: true,
      enableSvgImageDnrPolicy: true,
      enableContentNeutralization: false,
    });
    expect("unsupportedFlag" in normalized.compatibility).toBe(false);
  });

  it("falls back to defaults for non-plain or invalid policy input", () => {
    expect(normalizePolicy([] as unknown as Record<string, never>)).toEqual(DEFAULT_SITE_POLICY);
    expect(normalizePolicy({ mode: "unsupported", logRetentionDays: Number.NaN }).mode).toBe(DEFAULT_SITE_POLICY.mode);
    expect(normalizePolicy({ mode: "unsupported", logRetentionDays: Number.NaN }).logRetentionDays).toBe(DEFAULT_SITE_POLICY.logRetentionDays);
  });

  it("caps per-origin mode entries and origin lists", () => {
    const origins = Array.from({ length: POLICY_LIMITS.maxOriginsPerList + 5 }, (_, index) => `https://origin-${index}.example`);
    const modes = Object.fromEntries(Array.from({ length: POLICY_LIMITS.maxPerOriginModes + 5 }, (_, index) => [`https://mode-${index}.example`, "trusted"]));
    const normalized = normalizePolicy({ trustedOrigins: origins, perOriginModes: modes });

    expect(normalized.trustedOrigins).toHaveLength(POLICY_LIMITS.maxOriginsPerList);
    expect(Object.keys(normalized.perOriginModes)).toHaveLength(POLICY_LIMITS.maxPerOriginModes);
  });
});
