import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { validateOptionalTurnstileToken, type TurnstileEnvironment } from "../../lib/server/turnstile";
import { buildExpiredHitCookies, createTestSessionId, jsonResponse } from "../../lib/server/testSession";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await safeJson(request);
  const token = typeof body?.turnstileToken === "string" ? body.turnstileToken : null;
  const validation = await validateOptionalTurnstileToken(request, env as TurnstileEnvironment, token);

  if (!validation.accepted) {
    return jsonResponse({ ok: false, turnstile: validation }, { status: 403 });
  }

  const headers = new Headers();
  for (const expiredCookie of buildExpiredHitCookies()) headers.append("set-cookie", expiredCookie);

  return jsonResponse(
    {
      ok: true,
      sessionId: createTestSessionId(),
      turnstile: validation,
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
