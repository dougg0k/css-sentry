import { describe, expect, it } from "vitest";
import { hasDeclarativeNetRequestSessionRuleApi, getSessionRules } from "../../../src/browser/platform/dnrApi";
import { readBrowserCapabilities } from "../../../src/browser/platform/browserCapabilities";

describe("browser platform capability wrappers", () => {
  it("exposes DNR optionality through a narrow platform boundary", async () => {
    expect(hasDeclarativeNetRequestSessionRuleApi()).toBe(true);
    expect(await getSessionRules()).toEqual([]);
    expect(readBrowserCapabilities()).toMatchObject({ declarativeNetRequestSessionRules: true });
  });
});
