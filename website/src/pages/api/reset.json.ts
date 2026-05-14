import type { APIRoute } from "astro";
import { buildExpiredHitCookies, jsonResponse } from "../../lib/server/testSession";

export const prerender = false;

export const POST: APIRoute = () => {
  const headers = new Headers();
  for (const expiredCookie of buildExpiredHitCookies()) headers.append("set-cookie", expiredCookie);
  return jsonResponse({ ok: true }, { headers });
};
