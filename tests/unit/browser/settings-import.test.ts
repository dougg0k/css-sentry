import { describe, expect, it } from "vitest";
import { POLICY_LIMITS } from "../../../src/shared/constants";
import { parseImportedSitePolicy } from "../../../src/browser/storage/settingsImport";

describe("settings import", () => {
  it("parses JSON object settings through policy normalization", () => {
    const imported = parseImportedSitePolicy(JSON.stringify({
      mode: "strict",
      logRetentionDays: 10_000,
      strictOrigins: ["https://app.example", "javascript:alert(1)", null],
      perOriginModes: { "https://app.example": "trusted", "https://bad.example": "invalid" },
      allowlistedOrigins: ["https://attacker.example"],
      blocklistedOrigins: ["https://attacker.example"],
      compatibility: { enableDnrMitigation: false, neverFetchRemoteCssFromExtension: false, unknownKey: true },
    }));

    expect(imported.mode).toBe("strict");
    expect(imported.logRetentionDays).toBe(90);
    expect(imported.strictOrigins).toEqual(["https://app.example"]);
    expect(imported.allowlistedOrigins).not.toContain("https://attacker.example");
    expect(imported.perOriginModes).toEqual({ "https://app.example": "trusted" });
    expect(imported.compatibility.enableDnrMitigation).toBe(false);
    expect("neverFetchRemoteCssFromExtension" in imported.compatibility).toBe(false);
  });

  it("rejects non-object JSON and oversized settings imports", () => {
    expect(() => parseImportedSitePolicy("[]")).toThrow("Settings import must be a JSON object.");
    expect(() => parseImportedSitePolicy("x".repeat(POLICY_LIMITS.maxImportedSettingsBytes + 1))).toThrow(`Settings import exceeds ${POLICY_LIMITS.maxImportedSettingsBytes} bytes.`);
  });
});
