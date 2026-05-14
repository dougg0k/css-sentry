import { isKnownTestCaseId, TEST_CASE_IDS, type TestCaseId } from "../../data/testCases";
import { isValidTestSessionId } from "../testProtocol";
export { isValidTestSessionId } from "../testProtocol";

const COOKIE_PREFIX = "css_sentry_hit_";
const COOKIE_MAX_AGE_SECONDS = 120;

export interface HitCookie {
  readonly name: string;
  readonly value: string;
}

export function createTestSessionId(): string {
  return crypto.randomUUID();
}

export function parseRequestedTestCase(value: string | undefined): TestCaseId | null {
  if (!value || !isKnownTestCaseId(value)) return null;
  return value;
}

export function hitCookieName(testCaseId: TestCaseId): string {
  return `${COOKIE_PREFIX}${testCaseId.replaceAll("-", "_")}`;
}

export function buildHitCookie(testCaseId: TestCaseId, sessionId: string): string {
  const name = hitCookieName(testCaseId);
  return `${name}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function buildExpiredHitCookies(): readonly string[] {
  return TEST_CASE_IDS.map((testCaseId) => `${hitCookieName(testCaseId)}=; Path=/; Max-Age=0; SameSite=Lax`);
}

export function readHitCookie(request: Request, testCaseId: TestCaseId): HitCookie | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const name = hitCookieName(testCaseId);
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const raw = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!raw) return null;
  return { name, value: decodeURIComponent(raw.slice(name.length + 1)) };
}

export function requestClientAddress(request: Request): string | null {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function svgPixelResponse(headers: Headers): Response {
  headers.set("content-type", "image/svg+xml; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="transparent"/></svg>', { headers });
}
