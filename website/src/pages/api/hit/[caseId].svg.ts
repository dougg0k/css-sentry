import type { APIRoute } from "astro";
import { buildHitCookie, isValidTestSessionId, parseRequestedTestCase, svgPixelResponse } from "../../../lib/server/testSession";

export const prerender = false;

export const GET: APIRoute = ({ params, request }) => {
  const testCaseId = parseRequestedTestCase(params.caseId?.replace(/\.svg$/, ""));
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");

  if (!testCaseId || !isValidTestSessionId(sessionId)) {
    return new Response("Invalid CSS Sentry test hit request", { status: 400, headers: { "cache-control": "no-store" } });
  }

  const headers = new Headers();
  headers.append("set-cookie", buildHitCookie(testCaseId, sessionId));
  return svgPixelResponse(headers);
};
