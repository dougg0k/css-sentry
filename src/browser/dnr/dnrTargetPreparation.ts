import type { Finding } from "../../shared/types";

const ASCII_RE = /^[\x00-\x7F]+$/;
const MAX_REGEX_FILTER_LENGTH = 1_800;
const MAX_EXACT_REQUEST_URL_LENGTH = 4_000;

export type DnrSkippedTargetReason = "unsupported_url" | "url_too_long" | "regex_too_long" | "non_ascii_url" | "rule_update_failed";

export interface DnrSkippedTarget {
  findingId?: string;
  url: string | null;
  reason: DnrSkippedTargetReason;
}

export interface RequestRuleTarget {
  requestUrl: string;
  hostname: string;
  regexFilter: string;
}

export interface PolicyRuleTarget {
  origin: string;
  hostname: string;
  regexFilter: string;
}

export function prepareRequestRuleTarget(value: string): { ok: true; target: RequestRuleTarget } | { ok: false; reason: DnrSkippedTargetReason; url: string | null } {
  const parsed = parseUrl(value);
  if (!isHttpUrl(parsed)) return { ok: false, reason: "unsupported_url", url: null };

  const requestUrl = dnrRequestUrl(parsed);
  if (requestUrl.length > MAX_EXACT_REQUEST_URL_LENGTH) return { ok: false, reason: "url_too_long", url: null };
  if (!isAscii(requestUrl)) return { ok: false, reason: "non_ascii_url", url: null };

  const regexFilter = preciseRequestRegex(parsed);
  if (regexFilter.length > MAX_REGEX_FILTER_LENGTH) return { ok: false, reason: "regex_too_long", url: requestUrl };

  return { ok: true, target: { requestUrl, hostname: parsed.hostname, regexFilter } };
}

export function initiatorDomainsForFinding(finding: Finding): string[] | undefined {
  const domains = new Set<string>();
  for (const origin of [finding.frameOrigin, finding.pageOrigin, finding.sourceOrigin]) {
    if (typeof origin !== "string" || origin.length === 0) continue;
    const hostname = parseUrl(origin)?.hostname;
    if (hostname && isAscii(hostname)) domains.add(hostname);
  }
  return domains.size > 0 ? [...domains] : undefined;
}

export function originsToRuleTargets(origins: readonly string[]): PolicyRuleTarget[] {
  const targets = new Map<string, PolicyRuleTarget>();

  for (const origin of origins) {
    const parsed = parseUrl(origin);
    if (!isHttpUrl(parsed)) continue;

    const regexFilter = `^${escapeRegex(parsed.origin)}/`;
    if (regexFilter.length > MAX_REGEX_FILTER_LENGTH || !isAscii(regexFilter)) continue;

    targets.set(parsed.origin, {
      origin: parsed.origin,
      hostname: parsed.hostname,
      regexFilter,
    });
  }

  return [...targets.values()].sort((left, right) => left.origin.localeCompare(right.origin));
}

export function dnrRequestUrl(url: URL): string {
  const clone = new URL(url.href);
  clone.hash = "";
  return clone.href;
}

export function preciseRequestRegex(url: URL): string {
  return `^${escapeRegex(dnrRequestUrl(url))}$`;
}

export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isHttpUrl(value: URL | null): value is URL {
  return value !== null && /^https?:$/.test(value.protocol);
}

export function isAscii(value: string): boolean {
  return ASCII_RE.test(value);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
