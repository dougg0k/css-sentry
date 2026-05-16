import { describe, expect, it } from "vitest";
import { analyzeStylesheet } from "../../../src/core/analyzer/analyzeStylesheet";
import { TEST_CASES } from "../../../website/src/data/testCases";
import { TURNSTILE_TEST_LAB_ACTION, buildControlledTestCss, endpointUrl, isCloudflareWorkerTestLabOrigin, isDiagnosticCapableTestLabOrigin, isLocalTestLabOrigin, parseRequestedCaseList, testLabDiagnosticOrigin, visibleCssForTestCase } from "../../../website/src/lib/testProtocol";

const TEST_SESSION_ID = "00000000-0000-4000-8000-000000000000";
const TEST_ORIGIN = "http://localhost:4321";

describe("website test protocol", () => {
  it("defines the Turnstile action used by the client widget and server validator", () => {
    expect(TURNSTILE_TEST_LAB_ACTION).toBe("test_lab_session");
  });

  it("places imports before normal rules and emits absolute endpoint URLs", () => {
    const css = buildControlledTestCss(TEST_SESSION_ID, ["attribute-selector", "import-rule"], TEST_ORIGIN);

    expect(css.trim().startsWith('@import url("http://localhost:4321/test-assets/import-probe.css')).toBe(true);
    expect(css).toContain('background-image: url("http://localhost:4321/api/hit/attribute-selector.svg?session=00000000-0000-4000-8000-000000000000")');
  });

  it("emits known detector CSS that CSS Sentry classifies as actionable", () => {
    const css = buildControlledTestCss(TEST_SESSION_ID, ["known-detector-smoke"], "https://css-sentry-test-lab.example.workers.dev");
    const summary = analyzeStylesheet({
      cssText: css,
      pageUrl: "https://css-sentry-test-lab.example.workers.dev/tests/",
      sourceKind: "style_element",
      sourceUrl: "https://css-sentry-test-lab.example.workers.dev/tests/",
    });

    expect(summary.findings.length).toBeGreaterThan(0);
    expect(summary.findings[0]?.severity).not.toBe("info");
  });

  it("emits every live and advanced-live test case without dropping selected ids", () => {
    const ids = TEST_CASES.filter((testCase) => testCase.status === "live" || testCase.status === "advanced-live").map((testCase) => testCase.id);
    const css = buildControlledTestCss(TEST_SESSION_ID, ids, TEST_ORIGIN);

    for (const id of ids) {
      const definition = TEST_CASES.find((testCase) => testCase.id === id);
      if (definition?.status === "manual-explanation") continue;
      expect(css).toContain(TEST_SESSION_ID);
    }
    expect(css).toContain("known-detector-smoke.svg");
    expect(css).toContain("selector-exact.svg");
    expect(css).toContain("selector-prefix.svg");
    expect(css).toContain("selector-suffix.svg");
    expect(css).toContain("relational-has.svg");
    expect(css).toContain("remote-font-signal.woff2");
  });

  it("classifies local, supported Cloudflare Worker, and unsupported diagnostic origins", () => {
    expect(isLocalTestLabOrigin("localhost")).toBe(true);
    expect(isLocalTestLabOrigin("127.0.0.1")).toBe(true);
    expect(isLocalTestLabOrigin("example.com")).toBe(false);
    expect(isCloudflareWorkerTestLabOrigin("css-sentry-test-lab.example.workers.dev")).toBe(true);
    expect(isCloudflareWorkerTestLabOrigin("other-test-lab.example.workers.dev")).toBe(false);
    expect(testLabDiagnosticOrigin("css-sentry-test-lab.example.workers.dev")).toBe("public");
    expect(testLabDiagnosticOrigin("example.com")).toBe("unsupported");
    expect(isDiagnosticCapableTestLabOrigin("css-sentry-test-lab.example.workers.dev")).toBe(true);
  });

  it("parses a deduplicated requested case list and rejects unknown cases", () => {
    expect(parseRequestedCaseList("attribute-selector,unknown,attribute-selector,selector-prefix")).toEqual(["attribute-selector", "selector-prefix"]);
  });

  it("renders user-visible CSS with the same endpoint used by the active check", () => {
    const expected = endpointUrl(TEST_ORIGIN, "custom-property-sink", TEST_SESSION_ID);

    expect(visibleCssForTestCase("custom-property-sink", TEST_SESSION_ID, TEST_ORIGIN)).toContain(expected);
  });

  it("keeps large stress cases out of the default selected run", () => {
    expect(parseRequestedCaseList(null)).not.toContain("large-stylesheet");
  });

});
