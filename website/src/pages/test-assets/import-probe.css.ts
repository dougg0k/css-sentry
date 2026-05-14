import type { APIRoute } from "astro";
import { isKnownTestCaseId } from "../../data/testCases";
import { isValidTestSessionId } from "../../lib/server/testSession";
import { endpointUrl } from "../../lib/testProtocol";

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  if (!isValidTestSessionId(sessionId)) {
    return cssResponse("", 400);
  }

  const requestedVariant = url.searchParams.get("variant");
  const testCaseId = requestedVariant && isKnownTestCaseId(requestedVariant) ? requestedVariant : "import-rule";
  const endpoint = endpointUrl(url.origin, testCaseId, sessionId);
  const css = `#css-sentry-fixtures input[name="session_token"][value*="CSS-SENTRY-SENTINEL"] ~ #css-sentry-visible-probe { background-image: url("${endpoint}"); }`;
  return cssResponse(css);
};

function cssResponse(css: string, status = 200): Response {
  return new Response(css, { status, headers: { "cache-control": "no-store", "content-type": "text/css; charset=utf-8" } });
}
