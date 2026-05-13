import { describe, expect, it } from "vitest";
import { dnrRequestUrl, initiatorDomainsForFinding, originsToRuleTargets, prepareRequestRuleTarget } from "../../../src/browser/dnr/dnrTargetPreparation";
import type { Finding } from "../../../src/shared/types";

const findingBase: Finding = {
  id: "finding-1",
  severity: "high",
  confidence: 0.9,
  pageUrl: "https://app.example/account",
  pageOrigin: "https://app.example",
  frameUrl: "https://frame.example/page",
  frameOrigin: "https://frame.example",
  sourceKind: "style_element",
  sourceUrl: "https://source.example/style.css",
  sourceOrigin: "https://source.example",
  selector: "input[value^=a]",
  property: "background",
  destinationOrigin: "https://attacker.example",
  destinationUrl: "https://attacker.example/a",
  requestUrl: "https://attacker.example/a",
  action: "logged",
  state: "analysis.complete",
  reasons: ["selector.attribute.prefix_match", "sink.remote_url", "url.cross_origin"],
  timestamp: 1,
  details: "test finding",
};

describe("DNR target preparation", () => {
  it("normalizes exact request URLs by removing fragments before regex creation", () => {
    const target = prepareRequestRuleTarget("https://attacker.example/path.css#fragment");
    expect(target.ok).toBe(true);
    if (target.ok) {
      expect(target.target.requestUrl).toBe("https://attacker.example/path.css");
      expect(target.target.regexFilter).toBe("^https://attacker\\.example/path\\.css$");
    }
    expect(dnrRequestUrl(new URL("https://attacker.example/a.svg#x"))).toBe("https://attacker.example/a.svg");
    expect(prepareRequestRuleTarget("https://exämple.test/pixel#fragment")).toEqual({
      ok: true,
      target: {
        requestUrl: "https://xn--exmple-cua.test/pixel",
        hostname: "xn--exmple-cua.test",
        regexFilter: "^https://xn--exmple-cua\\.test/pixel$",
      },
    });
  });

  it("rejects unsupported, overlong, and overlong-regex finding-rule targets before DNR rule creation", () => {
    expect(prepareRequestRuleTarget("javascript:alert(1)")).toEqual({ ok: false, reason: "unsupported_url", url: null });
    expect(prepareRequestRuleTarget(`https://attacker.example/${"a".repeat(5_000)}`)).toEqual({ ok: false, reason: "url_too_long", url: null });
    expect(prepareRequestRuleTarget(`https://attacker.example/${".".repeat(1_790)}`)).toEqual({ ok: false, reason: "regex_too_long", url: `https://attacker.example/${".".repeat(1_790)}` });
  });

  it("deduplicates, sorts, and filters policy origins into DNR regex targets", () => {
    expect(originsToRuleTargets([
      "https://z.example/path",
      "ftp://files.example",
      "https://a.example/#fragment",
      "https://z.example/other",
      "https://exämple.test/path",
      "not a url",
    ])).toEqual([
      { origin: "https://a.example", hostname: "a.example", regexFilter: "^https://a\\.example/" },
      { origin: "https://xn--exmple-cua.test", hostname: "xn--exmple-cua.test", regexFilter: "^https://xn--exmple-cua\\.test/" },
      { origin: "https://z.example", hostname: "z.example", regexFilter: "^https://z\\.example/" },
    ]);
  });

  it("derives canonical ASCII initiator domains from finding frame, page, and source origins", () => {
    expect(initiatorDomainsForFinding(findingBase)).toEqual(["frame.example", "app.example", "source.example"]);
    expect(initiatorDomainsForFinding({ ...findingBase, frameOrigin: "https://exämple.test", pageOrigin: null, sourceOrigin: null })).toEqual(["xn--exmple-cua.test"]);
    expect(initiatorDomainsForFinding({ ...findingBase, frameOrigin: "null", pageOrigin: "about:blank", sourceOrigin: "" })).toBeUndefined();
  });
});
