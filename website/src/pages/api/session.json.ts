import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { validateOptionalTurnstileToken, type TurnstileEnvironment, type TurnstileValidationResult } from "../../lib/server/turnstile";
import { buildExpiredHitCookies, createTestSessionId, jsonResponse } from "../../lib/server/testSession";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await safeJson(request);
  const token = typeof body?.turnstileToken === "string" ? body.turnstileToken : null;
  const validation = await validateOptionalTurnstileToken(request, env as TurnstileEnvironment, token);

  if (!validation.accepted) {
    return jsonResponse({ ok: false, turnstile: publicTurnstileValidation(validation) }, { status: 403 });
  }

  const headers = new Headers();
  for (const expiredCookie of buildExpiredHitCookies()) headers.append("set-cookie", expiredCookie);
  if (validation.verificationCookie) headers.append("set-cookie", validation.verificationCookie);

  return jsonResponse(
    {
      ok: true,
      sessionId: createTestSessionId(),
      turnstile: publicTurnstileValidation(validation),
      expiresInSeconds: 120,
    },
    { headers },
  );
};

async function safeJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}


function publicTurnstileValidation(validation: TurnstileValidationResult): Omit<TurnstileValidationResult, "verificationCookie"> {
  return {
    enabled: validation.enabled,
    accepted: validation.accepted,
    reason: validation.reason,
  };
}
