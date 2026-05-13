import type { CssUrlAnalysis } from "../../shared/types";
import { cssUnescape, unquoteCssString } from "./text";

const URL_FUNCTION_RE = /url\(\s*((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*')|(?:\\.|[^)])*)\s*\)/gim;
const IMAGE_SET_FUNCTION_RE = /(?:-webkit-)?image-set\s*\(/gim;
const IMAGE_SET_STRING_RE = /((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*'))\s*(?:\d+(?:\.\d+)?x|\d+(?:\.\d+)?dpi|\d+(?:\.\d+)?dppx|\d+%)?/gim;
const IMPORT_RE = /@import\s+(?:url\(\s*)?((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*')|[^\s;)]+)(?:\s*\))?/gim;

function isLikelyHighEntropy(value: string): boolean {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length < 24) return false;
  const unique = new Set(compact).size;
  return unique >= 12 && /[a-z]/.test(compact) && /[A-Z0-9]/.test(compact);
}

function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function analyzeResourceUrl(rawInput: string, baseUrl: string, options: { isImageSet?: boolean } = {}): CssUrlAnalysis {
  const unquoted = unquoteCssString(rawInput);
  const lower = unquoted.trim().toLowerCase();
  let normalized: string | null = null;
  let scheme: string | null = null;
  let origin: string | null = null;
  let isRemote = false;
  let isCrossOrigin = false;
  let isSvgReference = false;
  const isImageSet = options.isImageSet === true;
  let isLocalNetwork = false;
  const isData = lower.startsWith("data:");
  const isSafeDataUrl = isData;

  try {
    const url = new URL(unquoted, baseUrl);
    normalized = url.href;
    scheme = url.protocol.replace(/:$/, "") || null;
    origin = url.origin === "null" ? null : url.origin;
    isRemote = scheme === "http" || scheme === "https";
    const baseOrigin = new URL(baseUrl).origin;
    isCrossOrigin = isRemote && origin !== baseOrigin;
    isSvgReference = /\.svg(?:[?#]|$)/i.test(url.pathname);
    isLocalNetwork = isRemote && isLocalNetworkHost(url.hostname);
  } catch {
    if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//")) isRemote = true;
  }

  return { raw: rawInput, unquoted, normalized, scheme, origin, isRemote, isCrossOrigin, isData, isSafeDataUrl, isSvgReference, isImageSet, isHighEntropy: isLikelyHighEntropy(unquoted), isLocalNetwork };
}

export function extractUrls(value: string, baseUrl: string): CssUrlAnalysis[] {
  const urls: CssUrlAnalysis[] = [];
  const searchable = cssUnescape(value.replace(/\/\*[\s\S]*?\*\//g, ""));
  const imageSetRanges = extractImageSetRanges(searchable);
  for (const match of searchable.matchAll(URL_FUNCTION_RE)) {
    const index = match.index ?? -1;
    urls.push(analyzeResourceUrl(match[1] ?? "", baseUrl, { isImageSet: imageSetRanges.some((range) => index >= range.start && index <= range.end) }));
  }
  for (const args of imageSetRanges.map((range) => searchable.slice(range.openIndex + 1, range.end))) {
    for (const match of args.matchAll(IMAGE_SET_STRING_RE)) {
      const raw = match[1] ?? "";
      if (isLikelyImageSetUrlToken(raw)) urls.push(analyzeResourceUrl(raw, baseUrl, { isImageSet: true }));
    }
  }
  return dedupeUrls(urls);
}

interface ImageSetRange { start: number; openIndex: number; end: number }

function extractImageSetRanges(value: string): ImageSetRange[] {
  const ranges: ImageSetRange[] = [];
  IMAGE_SET_FUNCTION_RE.lastIndex = 0;
  for (const match of value.matchAll(IMAGE_SET_FUNCTION_RE)) {
    const start = match.index ?? 0;
    const openIndex = start + match[0].length - 1;
    const closeIndex = findMatchingParen(value, openIndex);
    if (closeIndex === -1) continue;
    ranges.push({ start, openIndex, end: closeIndex });
  }
  return ranges;
}

function findMatchingParen(value: string, openIndex: number): number {
  let quote: '"' | "'" | null = null;
  let depth = 0;
  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function isLikelyImageSetUrlToken(raw: string): boolean {
  const value = unquoteCssString(raw).trim();
  if (/^(?:https?:|data:|blob:|\/|\.\.?\/|#)/i.test(value)) return true;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(value);
}

export function extractImportUrls(cssText: string, baseUrl: string): CssUrlAnalysis[] {
  const urls: CssUrlAnalysis[] = [];
  const searchable = cssUnescape(cssText.replace(/\/\*[\s\S]*?\*\//g, ""));
  for (const match of searchable.matchAll(IMPORT_RE)) urls.push(analyzeResourceUrl(match[1] ?? "", baseUrl));
  return dedupeUrls(urls);
}

export function normalizeCssIdentifier(value: string): string {
  return cssUnescape(value).trim().toLowerCase();
}


function dedupeUrls(urls: CssUrlAnalysis[]): CssUrlAnalysis[] {
  const seen = new Set<string>();
  const output: CssUrlAnalysis[] = [];
  for (const url of urls) {
    const key = url.normalized ?? `${url.raw}:${url.isImageSet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(url);
  }
  return output;
}
