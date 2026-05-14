import type { APIRoute } from "astro";
import { isKnownTestCaseId, TEST_CASES } from "../../../data/testCases";
import { isValidTestSessionId, jsonResponse, readHitCookie } from "../../../lib/server/testSession";

export const prerender = false;

export const GET: APIRoute = ({ params, request }) => {
  const sessionId = params.sessionId ?? null;
  if (!isValidTestSessionId(sessionId)) {
    return jsonResponse({ ok: false, error: "invalid-session" }, { status: 400 });
  }

  const url = new URL(request.url);
  const cases = parseResultCases(url.searchParams);

  const results = cases.map((testCaseId) => {
    const cookie = readHitCookie(request, testCaseId);
    return {
      caseId: testCaseId,
      received: cookie?.value === sessionId,
    };
  });

  return jsonResponse({ ok: true, sessionId, results });
};

function parseResultCases(searchParams: URLSearchParams) {
  const singleCase = searchParams.get("case");
  if (singleCase && isKnownTestCaseId(singleCase)) return [singleCase];

  const requestedCases = searchParams.get("cases");
  if (!requestedCases) return TEST_CASES.map((testCase) => testCase.id);

  const cases = requestedCases
    .split(",")
    .map((caseId) => caseId.trim())
    .filter(isKnownTestCaseId);

  return cases.length > 0 ? [...new Set(cases)] : TEST_CASES.map((testCase) => testCase.id);
}
