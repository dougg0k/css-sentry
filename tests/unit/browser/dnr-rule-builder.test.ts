import { describe, expect, it } from "vitest";
import { buildPolicyRules, buildTabPolicyRules, globalPolicyRuleIds, toDnrRule } from "../../../src/browser/dnr/dnrRuleBuilder";
import { DEFAULT_SITE_POLICY } from "../../../src/shared/constants";

describe("DNR rule builder", () => {
  it("builds policy block rules before allow rules with stable priorities", () => {
    const rules = buildPolicyRules({
      ...DEFAULT_SITE_POLICY,
      blocklistedOrigins: ["https://blocked.example"],
      allowlistedOrigins: ["https://allowed.example"],
    }, 7, [790_000, 790_001], 80);

    expect(rules.map((item) => item.rule)).toEqual([
      toDnrRule({ id: 790_000, priority: 6, action: "block", regexFilter: "^https://blocked\\.example/", tabId: 7, resourceTypes: ["image", "stylesheet", "font", "media", "object", "other"] }),
      toDnrRule({ id: 790_001, priority: 5, action: "allow", regexFilter: "^https://allowed\\.example/", tabId: 7, resourceTypes: ["image", "stylesheet", "font", "media", "object", "other"] }),
    ]);
  });

  it("appends strict third-party and SVG image-document policy rules only when enabled and IDs remain", () => {
    const rules = buildTabPolicyRules({
      ...DEFAULT_SITE_POLICY,
      compatibility: {
        ...DEFAULT_SITE_POLICY.compatibility,
        enableStrictThirdPartyBlocking: true,
        enableSvgImageDnrPolicy: true,
      },
    }, 12, [790_000, 790_001], true);

    expect(rules).toHaveLength(2);
    expect(rules[0]?.rule.condition).toMatchObject({ tabIds: [12], domainType: "thirdParty", resourceTypes: ["stylesheet", "image", "font"] });
    expect(rules[1]?.rule.condition).toMatchObject({ tabIds: [12], domainType: "thirdParty", resourceTypes: ["image", "object", "other"], regexFilter: "^https?://[^?#]+\\.svg(?:[?#].*)?$" });
  });

  it("reserves the global policy rule ID range", () => {
    const ids = globalPolicyRuleIds();
    expect(ids).toHaveLength(120);
    expect(ids[0]).toBe(900_000);
    expect(ids.at(-1)).toBe(900_119);
  });
});
