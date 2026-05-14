import { requestClientAddress } from "./testSession";

export interface TurnstileEnvironment {
  readonly TURNSTILE_SECRET_KEY?: string;
}

export interface TurnstileValidationResult {
  readonly enabled: boolean;
  readonly accepted: boolean;
  readonly reason: "disabled" | "missing-token" | "siteverify-accepted" | "siteverify-rejected" | "siteverify-error";
}

interface SiteverifyResponse {
  readonly success?: boolean;
  readonly [key: string]: unknown;
}

const SITEVERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 3000;

export async function validateOptionalTurnstileToken(request: Request, env: TurnstileEnvironment, token: string | null): Promise<TurnstileValidationResult> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { enabled: false, accepted: true, reason: "disabled" };
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
    if (result.success === true) return { enabled: true, accepted: true, reason: "siteverify-accepted" };
    return { enabled: true, accepted: false, reason: "siteverify-rejected" };
  } catch {
    return { enabled: true, accepted: false, reason: "siteverify-error" };
  } finally {
    clearTimeout(timeout);
  }
}
