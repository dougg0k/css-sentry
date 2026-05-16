import type { AnalysisSummary, Finding, FrameReport, StoredTabReport } from "../../shared/types";
import { cssUnescape, unquoteCssString } from "../css/text";

const SENSITIVE_NAME_RE = /(csrf|xsrf|token|nonce|secret|password|passwd|pwd|session|auth|api[-_]?key|access[-_]?key|bearer|oauth|jwt|credential|anti[-_]?forgery|state|code)/i;
const TOKEN_LIKE_RE = /^[A-Za-z0-9+/_=-]{16,}$/;
const TOKEN_IN_TEXT_RE = /\b[A-Za-z0-9+/_=-]{24,}\b/g;
const ATTRIBUTE_VALUE_RE = /\[\s*([^\]\s~|^$*=]+)\s*(\^=|\$=|\*=|~=|\|=|=)\s*((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*')|[^\]\s]+)(\s*[is])?\s*\]/gi;
const ASSIGNMENT_RE = /\b(csrf|xsrf|token|nonce|secret|password|passwd|pwd|session|auth|api[-_]?key|access[-_]?key|bearer|oauth|jwt|credential|anti[-_]?forgery|state|code)([\w-]*)(\s*[=:]\s*)([^\s;,'")\]]+)/gi;
const URL_RE = /https?:\/\/[^\s"'<>`]+/gi;
const REDACTION_SCAN_MARGIN = 512;

export function redactSensitiveText(value: string, max = 96): string {
  const compact = collapseWhitespace(limitRedactionInput(value, max));
  const redactedAttributes = compact.replace(ATTRIBUTE_VALUE_RE, (match, rawName: string, operator: string, rawValue: string, flags: string = "") => {
    const name = cssUnescape(rawName).toLowerCase();
    const unquotedValue = unquoteCssString(String(rawValue));
    if (!shouldRedactValue(name, unquotedValue)) return match;
    const quote = rawValue.startsWith("'") ? "'" : rawValue.startsWith('"') ? '"' : '"';
    return `[${rawName}${operator}${quote}[redacted]${quote}${flags ?? ""}]`;
  });
  const redactedAssignments = redactedAttributes.replace(ASSIGNMENT_RE, "$1$2$3[redacted]");
  const redactedUrls = redactedAssignments.replace(URL_RE, (url) => redactSensitiveUrl(url) ?? "[redacted-url]");
  const redactedTokens = redactedUrls.replace(TOKEN_IN_TEXT_RE, (token) => tokenLooksSensitive(token) ? "[redacted]" : token);
  return redactedTokens.length > max ? `${redactedTokens.slice(0, max - 1)}…` : redactedTokens;
}

export function redactSensitiveUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    const pathSegments = url.pathname.split("/").map((segment) => redactPathSegment(segment));
    url.pathname = pathSegments.join("/");
    if (url.search) {
      const params = new URLSearchParams(url.search);
      for (const [key, paramValue] of [...params.entries()]) {
        params.set(key, shouldRedactValue(key, paramValue) || paramValue.length > 0 ? "[redacted]" : paramValue);
      }
      const serialized = replaceAllLiteral(params.toString(), "%5Bredacted%5D", "[redacted]");
      url.search = serialized ? `?${serialized}` : "";
    }
    if (url.hash) url.hash = "#[redacted]";
    return replaceAllLiteral(url.toString(), "%5Bredacted%5D", "[redacted]");
  } catch {
    return redactSensitiveText(value, 180);
  }
}

export function sanitizeFindingForStorage(finding: Finding): Finding {
  return {
    ...finding,
    pageUrl: redactSensitiveUrl(finding.pageUrl) ?? finding.pageUrl,
    frameUrl: redactSensitiveUrl(finding.frameUrl) ?? finding.frameUrl,
    sourceUrl: redactSensitiveUrl(finding.sourceUrl) ?? finding.sourceUrl,
    selector: finding.selector ? redactSensitiveText(finding.selector, 180) : null,
    destinationUrl: redactSensitiveUrl(finding.destinationUrl),
    requestUrl: null,
    details: redactSensitiveText(finding.details, 260)
  };
}

export function sanitizeSummaryForStorage(summary: AnalysisSummary): AnalysisSummary {
  return { ...summary, findings: summary.findings.map(sanitizeFindingForStorage) };
}

export function sanitizeFrameReportForStorage(frame: FrameReport): FrameReport {
  return {
    ...frame,
    frameUrl: redactSensitiveUrl(frame.frameUrl) ?? frame.frameUrl,
    summary: sanitizeSummaryForStorage(frame.summary)
  };
}

export function sanitizeStoredReportForExport(report: StoredTabReport): StoredTabReport {
  return {
    ...report,
    url: redactSensitiveUrl(report.url) ?? report.url,
    summary: sanitizeSummaryForStorage(report.summary),
    frames: report.frames.map(sanitizeFrameReportForStorage)
  };
}


function limitRedactionInput(value: string, max: number): string {
  const limit = Math.max(max + REDACTION_SCAN_MARGIN, max);
  return value.length > limit ? value.slice(0, limit) : value;
}

function collapseWhitespace(value: string): string {
  let output = "";
  let pendingSpace = false;
  let started = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    if (isWhitespace(char)) {
      if (started) pendingSpace = true;
      continue;
    }
    if (pendingSpace) output += " ";
    output += char;
    started = true;
    pendingSpace = false;
  }

  return output;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f" || char === "\v";
}

function replaceAllLiteral(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

function redactPathSegment(segment: string): string {
  if (!segment) return segment;
  const decoded = safeDecode(segment);
  if (shouldRedactValue("path", decoded) || decoded.length >= 48) return "[redacted]";
  return segment;
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function shouldRedactValue(name: string, value: string): boolean {
  const loweredName = name.toLowerCase();

  if (isStructuralSelectorAttribute(loweredName)) {
    return tokenLooksSensitive(value);
  }

  if (loweredName === "value") return true;
  if (SENSITIVE_NAME_RE.test(loweredName)) return true;
  if (SENSITIVE_NAME_RE.test(value)) return true;
  if (tokenLooksSensitive(value)) return true;
  return false;
}

function isStructuralSelectorAttribute(name: string): boolean {
  return name === "name" || name === "id" || name === "for" || name === "type" || name === "autocomplete" || name === "role";
}

function tokenLooksSensitive(value: string): boolean {
  const normalized = value.trim();
  if (!TOKEN_LIKE_RE.test(normalized)) return false;
  if (/^[0-9]+$/.test(normalized)) return normalized.length >= 24;
  return true;
}
