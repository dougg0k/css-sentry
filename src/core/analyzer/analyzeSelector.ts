import type { AttributeSelectorInfo, ReasonCode, SelectorAnalysis } from "../../shared/types";
import { cssUnescape, unquoteCssString } from "../css/text";

const ATTRIBUTE_SELECTOR_RE = /\[\s*([^\]\s~|^$*=]+)\s*(?:(\^=|\$=|\*=|~=|\|=|=)\s*((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*')|[^\]\s]+)?\s*([is])?)?\s*\]/gim;

const SENSITIVE_ATTRIBUTE_NAMES = new Set([
  "value", "name", "id", "href", "src", "action", "formaction",
  "data-token", "data-secret", "data-key", "data-session", "data-auth", "data-csrf", "data-xsrf", "data-nonce"
]);

const SENSITIVE_NAME_RE = /(csrf|xsrf|token|nonce|auth|session|secret|password|passwd|pwd|email|state|code|api[-_]?key|access[-_]?key|bearer|oauth|jwt|credential|anti[-_]?forgery)/i;
const FORM_CONTROL_RE = /\b(input|textarea|select|option)\b/i;
const HIDDEN_INPUT_RE = /\binput\b(?:\[[^\]]*\])*\[\s*type\s*=\s*['"]?hidden['"]?/i;

export function parseAttributeSelectors(selector: string): AttributeSelectorInfo[] {
  const attributes: AttributeSelectorInfo[] = [];
  for (const match of selector.matchAll(ATTRIBUTE_SELECTOR_RE)) {
    const name = cssUnescape(match[1] ?? "").toLowerCase();
    const operator = (match[2] as AttributeSelectorInfo["operator"]) ?? null;
    const value = match[3] ? unquoteCssString(match[3]) : null;
    const flags = match[4] ?? null;
    attributes.push({ name, operator, value, flags });
  }
  return attributes;
}

export function analyzeSelector(selector: string): SelectorAnalysis {
  const attributes = parseAttributeSelectors(selector);
  const reasons = new Set<ReasonCode>();
  let score = 0;

  if (/:has\s*\(/i.test(selector)) { score += 3; reasons.add("selector.relational.has"); }
  if (FORM_CONTROL_RE.test(selector)) { score += 1; reasons.add("selector.form_control"); }
  if (HIDDEN_INPUT_RE.test(selector)) { score += 3; reasons.add("selector.hidden_input"); }

  for (const attribute of attributes) {
    const isSensitiveName = SENSITIVE_ATTRIBUTE_NAMES.has(attribute.name) || SENSITIVE_NAME_RE.test(attribute.name) || (attribute.value !== null && SENSITIVE_NAME_RE.test(attribute.value));
    if (isSensitiveName) { score += 2; reasons.add("selector.attribute.sensitive_name"); }
    if (attribute.operator === "^=") { score += attribute.name === "value" ? 4 : 2; reasons.add("selector.attribute.prefix_match"); }
    else if (attribute.operator === "$=") { score += attribute.name === "value" ? 4 : 2; reasons.add("selector.attribute.suffix_match"); }
    else if (attribute.operator === "*=") { score += attribute.name === "value" ? 5 : 3; reasons.add("selector.attribute.substring_match"); }
    else if (attribute.operator === "=" && isSensitiveName) { score += 1; reasons.add("selector.attribute.exact_match"); }
  }

  if (hasRepeatedProbeShape(selector)) { score += 2; reasons.add("selector.repeated_probe_pattern"); }

  return { selector, score, reasons: [...reasons], attributes, isSensitive: score >= 3 };
}

function hasRepeatedProbeShape(selector: string): boolean {
  const attrProbeCount = [...selector.matchAll(/\[(?:[^\]]+)(?:\^=|\$=|\*=)/g)].length;
  const enumeratesLikelyAlphabet = /(?:\[value[\^$*]?=.{1,8}\]){2,}/i.test(selector);
  return attrProbeCount >= 2 || enumeratesLikelyAlphabet || /[A-Za-z0-9_-]{32,}/.test(selector);
}
