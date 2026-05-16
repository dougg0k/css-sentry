import { describe, expect, it } from "vitest";
import { interpretTestResult } from "../../../website/src/lib/resultInterpretation";

describe("website result interpretation", () => {
  it("separates scanner coverage from report-save acknowledgement", () => {
    const result = interpretTestResult({ hasSession: true, endpoint: "received", scan: "findings", report: "not-saved", manual: "not-checked", mode: "balanced" });

    expect(result.kind).toBe("unexpected");
    expect(result.title).toContain("report was not saved");
  });

  it("treats received endpoint plus zero findings as a detector or test-definition issue", () => {
    const result = interpretTestResult({ hasSession: true, endpoint: "received", scan: "connected-no-findings", report: "waiting", manual: "not-checked", mode: "balanced" });

    expect(result.kind).toBe("unexpected");
    expect(result.detail).toContain("test-definition");
  });

  it("distinguishes scan-disabled mode from a missing extension signal", () => {
    const result = interpretTestResult({ hasSession: true, endpoint: "received", scan: "scan-disabled", report: "not-saved", manual: "not-checked", mode: "trusted" });

    expect(result.kind).toBe("inconclusive");
    expect(result.title).toContain("scanning is disabled");
  });

  it("accepts passive report-only behavior when the endpoint is received", () => {
    const result = interpretTestResult({ hasSession: true, endpoint: "received", scan: "findings", report: "saved", manual: "reported", mode: "passive" });

    expect(result.kind).toBe("expected");
    expect(result.title).toContain("Passive");
  });

  it("treats supported public diagnostic absence as an unexpected extension signal failure", () => {
    const result = interpretTestResult({ hasSession: true, diagnosticOrigin: "public", endpoint: "received", scan: "not-connected", report: "not-saved", manual: "not-checked", mode: "balanced" });

    expect(result.kind).toBe("unexpected");
    expect(result.title).toContain("did not signal");
  });

  it("keeps unsupported origins in manual confirmation state", () => {
    const result = interpretTestResult({ hasSession: true, diagnosticOrigin: "unsupported", endpoint: "received", scan: "not-connected", report: "not-saved", manual: "not-checked", mode: "balanced" });

    expect(result.kind).toBe("review");
    expect(result.title).toContain("Manual report");
  });
});
