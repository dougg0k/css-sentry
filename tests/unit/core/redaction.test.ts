import { describe, expect, it } from "vitest";
import { redactSensitiveText, redactSensitiveUrl, sanitizeStoredReportForExport } from "../../../src/core/privacy/redaction";
import type { StoredTabReport } from "../../../src/shared/types";

const SECRET = "abcd1234abcd1234abcd1234";

describe("privacy redaction", () => {
  it("redacts sensitive selector attribute values while preserving selector shape", () => {
    const redacted = redactSensitiveText(`input[name="csrf_token"][value^="${SECRET}"]`);
    expect(redacted).toContain("csrf_token");
    expect(redacted).toContain("[value^=\"[redacted]\"]");
    expect(redacted).not.toContain(SECRET);
  });

  it("redacts URL credentials, query values, fragments, and token-like path segments", () => {
    const redacted = redactSensitiveUrl(`https://user:${SECRET}@attacker.example/leak/${SECRET}?csrf=${SECRET}&page=account#${SECRET}`);
    expect(redacted).toContain("https://attacker.example/leak/[redacted]");
    expect(redacted).toContain("csrf=[redacted]");
    expect(redacted).toContain("page=[redacted]");
    expect(redacted).toContain("#[redacted]");
    expect(redacted).not.toContain(SECRET);
    expect(redacted).not.toContain("user:");
  });

  it("sanitizes stored reports and exported diagnostics recursively", () => {
    const report: StoredTabReport = {
      tabId: 1,
      url: `https://app.example/account?session=${SECRET}`,
      origin: "https://app.example",
      updatedAt: Date.now(),
      summary: {
        state: "analysis.complete",
        findings: [
          {
            id: "finding-test",
            severity: "critical",
            confidence: 100,
            pageUrl: `https://app.example/account?session=${SECRET}`,
            pageOrigin: "https://app.example",
            frameUrl: `https://app.example/frame?nonce=${SECRET}`,
            frameOrigin: "https://app.example",
            sourceKind: "style_element",
            sourceUrl: `https://app.example/style.css?token=${SECRET}`,
            sourceOrigin: "https://app.example",
            selector: `input[name="csrf_token"][value^="${SECRET}"]`,
            property: "background-image",
            destinationOrigin: "https://attacker.example",
            destinationUrl: `https://attacker.example/leak?csrf=${SECRET}`,
            action: "blocked_dnr",
            state: "analysis.complete",
            reasons: ["selector.attribute.sensitive_name", "sink.remote_url"],
            timestamp: Date.now(),
            details: `CSS rule leaked token=${SECRET}`
          }
        ],
        analyzedStylesheets: 1,
        partialStylesheets: 0,
        analyzedFrames: 1,
        partialFrames: 0,
        startedAt: Date.now(),
        finishedAt: Date.now()
      },
      frames: []
    };

    const sanitized = sanitizeStoredReportForExport(report);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).toContain("https://attacker.example");
    expect(serialized).toContain("[redacted]");
  });

  it("keeps large generated selectors bounded before regex redaction", () => {
    const selector = `input[name="csrf_token"][value^="${SECRET}"] ${".generated-fixture ".repeat(5000)}`;
    const redacted = redactSensitiveText(selector, 140);

    expect(redacted.length).toBeLessThanOrEqual(140);
    expect(redacted).toContain("csrf_token");
    expect(redacted).toContain('[value^="[redacted]"]');
    expect(redacted).not.toContain(SECRET);
  });

});
