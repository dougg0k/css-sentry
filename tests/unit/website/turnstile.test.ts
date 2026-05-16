import { afterEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_TEST_LAB_ACTION } from "../../../website/src/lib/testProtocol";
import { validateOptionalTurnstileToken } from "../../../website/src/lib/server/turnstile";

function requestForHost(hostname: string, cookie?: string): Request {
  return new Request(`https://${hostname}/api/session.json`, {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.7",
      ...(cookie ? { cookie } : {}),
    },
  });
}

describe("website Turnstile validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays disabled until the Worker secret is configured", async () => {
    await expect(validateOptionalTurnstileToken(requestForHost("css-sentry-test-lab.example.workers.dev"), {}, null)).resolves.toEqual({
      enabled: false,
      accepted: true,
      reason: "disabled",
    });
  });

  it("requires a token when the Worker secret is configured", async () => {
    await expect(validateOptionalTurnstileToken(requestForHost("css-sentry-test-lab.example.workers.dev"), { TURNSTILE_SECRET_KEY: "secret" }, null)).resolves.toEqual({
      enabled: true,
      accepted: false,
      reason: "missing-token",
    });
  });

  it("accepts only successful tokens for the Test Lab action and request hostname", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      action: TURNSTILE_TEST_LAB_ACTION,
      hostname: "css-sentry-test-lab.example.workers.dev",
    }))));

    const result = await validateOptionalTurnstileToken(requestForHost("css-sentry-test-lab.example.workers.dev"), { TURNSTILE_SECRET_KEY: "secret" }, "token");

    expect(result).toMatchObject({
      enabled: true,
      accepted: true,
      reason: "siteverify-accepted",
    });
    expect(result.verificationCookie).toContain("css_sentry_turnstile_verified=");
  });

  it("accepts the signed first-party verification cookie after one successful challenge", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      action: TURNSTILE_TEST_LAB_ACTION,
      hostname: "css-sentry-test-lab.example.workers.dev",
    }))));

    const accepted = await validateOptionalTurnstileToken(requestForHost("css-sentry-test-lab.example.workers.dev"), { TURNSTILE_SECRET_KEY: "secret" }, "token");
    const cookiePair = accepted.verificationCookie?.split(";")[0];

    await expect(validateOptionalTurnstileToken(requestForHost("css-sentry-test-lab.example.workers.dev", cookiePair), { TURNSTILE_SECRET_KEY: "secret" }, null)).resolves.toMatchObject({
      enabled: true,
      accepted: true,
      reason: "site-cookie-accepted",
    });
  });

  it("rejects tokens issued for another action or hostname", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      action: "other_action",
      hostname: "css-sentry-test-lab.example.workers.dev",
    }))));

    await expect(validateOptionalTurnstileToken(requestForHost("css-sentry-test-lab.example.workers.dev"), { TURNSTILE_SECRET_KEY: "secret" }, "token")).resolves.toMatchObject({
      accepted: false,
      reason: "siteverify-action-mismatch",
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      action: TURNSTILE_TEST_LAB_ACTION,
      hostname: "example.com",
    }))));

    await expect(validateOptionalTurnstileToken(requestForHost("css-sentry-test-lab.example.workers.dev"), { TURNSTILE_SECRET_KEY: "secret" }, "token")).resolves.toMatchObject({
      accepted: false,
      reason: "siteverify-hostname-mismatch",
    });
  });
});
