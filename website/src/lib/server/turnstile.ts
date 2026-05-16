import { TURNSTILE_TEST_LAB_ACTION } from "../testProtocol";
import { requestClientAddress } from "./testSession";

export interface TurnstileEnvironment {
  readonly TURNSTILE_SECRET_KEY?: string;
}

export interface TurnstileValidationResult {
  readonly enabled: boolean;
  readonly accepted: boolean;
  readonly reason:
    | "disabled"
    | "site-cookie-accepted"
    | "missing-token"
    | "siteverify-accepted"
    | "siteverify-rejected"
    | "siteverify-error"
    | "siteverify-action-mismatch"
    | "siteverify-hostname-mismatch";
  readonly verificationCookie?: string;
}

interface SiteverifyResponse {
  readonly success?: boolean;
  readonly action?: string;
  readonly hostname?: string;
  readonly [key: string]: unknown;
}

const SITEVERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 3000;
const TURNSTILE_COOKIE_NAME = "css_sentry_turnstile_verified";
const TURNSTILE_COOKIE_MAX_AGE_SECONDS = 30 * 60;
const TURNSTILE_COOKIE_VERSION = "v1";

export async function validateOptionalTurnstileToken(request: Request, env: TurnstileEnvironment, token: string | null): Promise<TurnstileValidationResult> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { enabled: false, accepted: true, reason: "disabled" };
  if (await hasValidTurnstileVerificationCookie(request, secret)) return { enabled: true, accepted: true, reason: "site-cookie-accepted" };
  if (!token) return { enabled: true, accepted: false, reason: "missing-token" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(SITEVERIFY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: requestClientAddress(request) ?? undefined,
      }),
      signal: controller.signal,
    });
    const result = (await response.json()) as SiteverifyResponse;
    if (result.success !== true) return { enabled: true, accepted: false, reason: "siteverify-rejected" };
    if (result.action !== TURNSTILE_TEST_LAB_ACTION) return { enabled: true, accepted: false, reason: "siteverify-action-mismatch" };
    if (!turnstileHostnameMatchesRequest(request, result.hostname)) return { enabled: true, accepted: false, reason: "siteverify-hostname-mismatch" };
    return {
      enabled: true,
      accepted: true,
      reason: "siteverify-accepted",
      verificationCookie: await buildTurnstileVerificationCookie(request, secret),
    };
  } catch {
    return { enabled: true, accepted: false, reason: "siteverify-error" };
  } finally {
    clearTimeout(timeout);
  }
}

function turnstileHostnameMatchesRequest(request: Request, hostname: string | undefined): boolean {
  if (!hostname) return false;
  try {
    return hostname.toLowerCase() === new URL(request.url).hostname.toLowerCase();
  } catch {
    return false;
  }
}


async function hasValidTurnstileVerificationCookie(request: Request, secret: string): Promise<boolean> {
  const value = readCookie(request, TURNSTILE_COOKIE_NAME);
  if (!value) return false;
  const [version, expiresAtText, signature] = value.split(".");
  if (version !== TURNSTILE_COOKIE_VERSION || !expiresAtText || !signature) return false;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = await signTurnstileCookie(request, secret, expiresAt);
  return timingSafeEqual(signature, expected);
}

async function buildTurnstileVerificationCookie(request: Request, secret: string): Promise<string> {
  const expiresAt = Date.now() + TURNSTILE_COOKIE_MAX_AGE_SECONDS * 1000;
  const signature = await signTurnstileCookie(request, secret, expiresAt);
  const secure = request.url.startsWith("https://") ? "; Secure" : "";
  const value = `${TURNSTILE_COOKIE_VERSION}.${expiresAt}.${signature}`;
  return `${TURNSTILE_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${TURNSTILE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; HttpOnly${secure}`;
}

async function signTurnstileCookie(request: Request, secret: string, expiresAt: number): Promise<string> {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const payload = `css-sentry-test-lab-turnstile:${TURNSTILE_COOKIE_VERSION}:${hostname}:${expiresAt}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
