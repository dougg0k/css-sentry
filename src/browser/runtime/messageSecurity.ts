import type { AnalysisSummary, ExtensionMode, RuntimeMessage } from "../../shared/types";
import { ANALYSIS_LIMITS, REPORT_LIMITS } from "../../shared/constants";
import { isPolicyOrigin } from "../../shared/url";

const VALID_MODES = new Set<ExtensionMode>([
  "default",
  "passive",
  "balanced",
  "strict",
  "always_scan_never_sanitize",
  "never_scan_never_sanitize",
  "paused",
  "trusted",
]);

export interface RuntimeMessageValidation {
  ok: boolean;
  message?: RuntimeMessage;
  reason?: string;
}

export interface SenderLike {
  tab?: { id?: unknown; url?: unknown };
  frameId?: unknown;
  url?: unknown;
}

export function validateRuntimeMessage(message: unknown, sender: SenderLike): RuntimeMessageValidation {
  if (!isPlainObject(message)) return invalid("message is not an object");
  const type = typeof message.type === "string" ? message.type : "";

  if (type === "css-sentry:scan-complete") {
    if (!isContentScriptSender(sender)) return invalid("scan-complete requires a tab-bound content script sender");
    if (typeof message.url !== "string" || !isHttpLikeUrl(message.url)) return invalid("scan-complete url is invalid");
    if (!isAnalysisSummary(message.summary)) return invalid("scan-complete summary is invalid");
    return { ok: true, message: { type, url: message.url, summary: capSummary(message.summary) } };
  }

  if (type === "css-sentry:set-origin-mode") {
    if (!isExtensionPageSender(sender)) return invalid("set-origin-mode requires an extension UI sender");
    if (typeof message.origin !== "string" || !isPolicyOrigin(message.origin)) return invalid("set-origin-mode origin is invalid");
    if (typeof message.mode !== "string" || !VALID_MODES.has(message.mode as ExtensionMode)) return invalid("set-origin-mode mode is invalid");
    return { ok: true, message: { type, origin: message.origin, mode: message.mode as ExtensionMode } };
  }

  if (type === "css-sentry:clear-current-report") {
    if (!isExtensionPageSender(sender)) return invalid("clear-current-report requires an extension UI sender");
    const tabId = message.tabId;
    if (typeof tabId !== "number" || !Number.isInteger(tabId) || tabId < 0) return invalid("clear-current-report tabId is invalid");
    return { ok: true, message: { type, tabId } };
  }

  if (type === "css-sentry:policy-updated") {
    if (!isExtensionPageSender(sender)) return invalid("policy-updated requires an extension UI sender");
    return { ok: true, message: { type } };
  }

  return invalid("unknown css-sentry runtime message");
}

export function isContentScriptSender(sender: SenderLike): boolean {
  return Number.isInteger(sender.tab?.id) && (sender.frameId === undefined || Number.isInteger(sender.frameId));
}

export function isExtensionPageSender(sender: SenderLike): boolean {
  if (sender.tab) return false;
  if (typeof sender.url !== "string") return false;
  return sender.url.startsWith("chrome-extension://") || sender.url.startsWith("moz-extension://");
}

function isAnalysisSummary(value: unknown): value is AnalysisSummary {
  if (!isPlainObject(value)) return false;
  if (!Array.isArray(value.findings)) return false;
  return typeof value.state === "string"
    && Number.isFinite(value.analyzedStylesheets)
    && Number.isFinite(value.partialStylesheets)
    && Number.isFinite(value.analyzedFrames)
    && Number.isFinite(value.partialFrames)
    && Number.isFinite(value.startedAt)
    && Number.isFinite(value.finishedAt)
    && value.findings.length <= ANALYSIS_LIMITS.maxFindingsPerPage * 2;
}

function capSummary(summary: AnalysisSummary): AnalysisSummary {
  const findings = summary.findings.slice(0, REPORT_LIMITS.maxFindingsPerFrame);
  return {
    ...summary,
    findings,
    analyzedStylesheets: clampCount(summary.analyzedStylesheets),
    partialStylesheets: clampCount(summary.partialStylesheets),
    analyzedFrames: clampCount(summary.analyzedFrames),
    partialFrames: clampCount(summary.partialFrames),
  };
}

function clampCount(value: number): number {
  return Math.max(0, Math.min(Math.trunc(value), 10_000));
}

function isHttpLikeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:";
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalid(reason: string): RuntimeMessageValidation {
  return { ok: false, reason };
}
