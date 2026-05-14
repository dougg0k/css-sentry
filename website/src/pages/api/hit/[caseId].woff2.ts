import type { APIRoute } from "astro";
import { buildHitCookie, isValidTestSessionId, parseRequestedTestCase } from "../../../lib/server/testSession";

export const prerender = false;

export const GET: APIRoute = ({ params, request }) => {
  const testCaseId = parseRequestedTestCase(params.caseId?.replace(/\.woff2$/, ""));
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");

  if (!testCaseId || !isValidTestSessionId(sessionId)) {
    return new Response("Invalid CSS Sentry font test hit request", { status: 400, headers: { "cache-control": "no-store" } });
  }

  const headers = new Headers();
  headers.append("set-cookie", buildHitCookie(testCaseId, sessionId));
  headers.set("content-type", "font/woff2");
  headers.set("cache-control", "no-store");
  return new Response(new Uint8Array(), { headers });
};
