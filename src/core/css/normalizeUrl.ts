import type { CssUrlAnalysis } from "../../shared/types";
import { cssUnescape, unquoteCssString } from "./text";

const URL_FUNCTION_RE = /url\(\s*((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*')|(?:\\.|[^)])*)\s*\)/gim;
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

export function analyzeResourceUrl(rawInput: string, baseUrl: string): CssUrlAnalysis {
  const unquoted = unquoteCssString(rawInput);
  const lower = unquoted.trim().toLowerCase();
  let normalized: string | null = null;
  let scheme: string | null = null;
  let origin: string | null = null;
  let isRemote = false;
  let isCrossOrigin = false;
  let isSvgReference = false;
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
    isSvgReference = url.hash.length > 0 || /\.svg(?:[?#]|$)/i.test(url.pathname);
    isLocalNetwork = isRemote && isLocalNetworkHost(url.hostname);
  } catch {
    if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//")) isRemote = true;
  }

  return { raw: rawInput, unquoted, normalized, scheme, origin, isRemote, isCrossOrigin, isData, isSafeDataUrl, isSvgReference, isHighEntropy: isLikelyHighEntropy(unquoted), isLocalNetwork };
}

export function extractUrls(value: string, baseUrl: string): CssUrlAnalysis[] {
  const urls: CssUrlAnalysis[] = [];
  const searchable = cssUnescape(value.replace(/\/\*[\s\S]*?\*\//g, ""));
  for (const match of searchable.matchAll(URL_FUNCTION_RE)) urls.push(analyzeResourceUrl(match[1] ?? "", baseUrl));
  return urls;
}

export function extractImportUrls(cssText: string, baseUrl: string): CssUrlAnalysis[] {
  const urls: CssUrlAnalysis[] = [];
  const searchable = cssUnescape(cssText.replace(/\/\*[\s\S]*?\*\//g, ""));
  for (const match of searchable.matchAll(IMPORT_RE)) urls.push(analyzeResourceUrl(match[1] ?? "", baseUrl));
  return urls;
}

export function normalizeCssIdentifier(value: string): string {
  return cssUnescape(value).trim().toLowerCase();
}
