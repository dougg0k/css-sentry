import type { APIRoute } from "astro";
import { buildControlledTestCss, isValidTestSessionId, parseRequestedCaseList } from "../../../lib/testProtocol";

export const prerender = false;

export const GET: APIRoute = ({ params, request }) => {
  const sessionId = params.sessionId?.replace(/\.css$/, "") ?? null;
  if (!isValidTestSessionId(sessionId)) return cssResponse("", 400);

  const url = new URL(request.url);
  const cases = parseRequestedCaseList(url.searchParams.get("cases"));
  return cssResponse(buildControlledTestCss(sessionId, cases, url.origin));
};

function cssResponse(css: string, status = 200): Response {
  return new Response(css, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/css; charset=utf-8",
    },
  });
}
