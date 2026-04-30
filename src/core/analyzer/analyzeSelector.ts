import type { AttributeSelectorInfo, ReasonCode, SelectorAnalysis } from "../../shared/types";
import { cssUnescape, unquoteCssString } from "../css/text";

const ATTRIBUTE_SELECTOR_RE = /\[\s*([^\]\s~|^$*=]+)\s*(?:(\^=|\$=|\*=|~=|\|=|=)\s*((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*')|[^\]\s]+)?\s*([is])?)?\s*\]/gim;

const SECRET_ATTRIBUTE_NAMES = new Set([
  "value", "data-token", "data-secret", "data-key", "data-session", "data-auth", "data-csrf", "data-xsrf", "data-nonce"
]);

const NAME_LIKE_ATTRIBUTES = new Set(["name", "id", "href", "src", "action", "formaction"]);
const NON_SECRET_VALUE_ATTRIBUTES = new Set([
  "class", "type", "role", "aria-label", "aria-hidden", "aria-expanded", "aria-selected", "aria-controls",
  "data-type", "data-state", "data-theme", "data-color-mode", "data-light-theme", "data-dark-theme", "data-selected", "data-variant", "data-value"
]);

const SENSITIVE_NAME_RE = /(csrf|xsrf|token|nonce|auth|session|secret|password|passwd|pwd|email|state|code|api[-_]?key|access[-_]?key|bearer|oauth|jwt|credential|anti[-_]?forgery)/i;
const FORM_CONTROL_RE = /\b(input|textarea|select|option)\b/i;
const HIDDEN_INPUT_RE = /\binput\b(?:\[[^\]]*\])*\[\s*type\s*=\s*['"]?hidden['"]?/i;
const PROBE_OPERATORS = new Set<AttributeSelectorInfo["operator"]>(["^=", "$=", "*="]);

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

  if (/:has\s*\(/i.test(selector)) { score += 1; reasons.add("selector.relational.has"); }
  if (FORM_CONTROL_RE.test(selector)) { score += 1; reasons.add("selector.form_control"); }
  if (HIDDEN_INPUT_RE.test(selector)) { score += 3; reasons.add("selector.hidden_input"); }

  for (const attribute of attributes) {
    const secretName = isSecretAttributeName(attribute.name);
    const sensitiveValue = hasSensitiveAttributeValue(attribute);
    const sensitiveAttribute = secretName || sensitiveValue;
    const probeOperator = isProbeOperator(attribute.operator);

    if (sensitiveAttribute) { score += 2; reasons.add("selector.attribute.sensitive_name"); }

    if (attribute.operator === "^=") {
      const probeScore = probeScoreForAttribute(attribute, secretName, sensitiveValue, 4, 3);
      if (probeScore > 0) score += probeScore;
      reasons.add("selector.attribute.prefix_match");
    } else if (attribute.operator === "$=") {
      const probeScore = probeScoreForAttribute(attribute, secretName, sensitiveValue, 4, 3);
      if (probeScore > 0) score += probeScore;
      reasons.add("selector.attribute.suffix_match");
    } else if (attribute.operator === "*=") {
      const probeScore = probeScoreForAttribute(attribute, secretName, sensitiveValue, 5, 3);
      if (probeScore > 0) score += probeScore;
      reasons.add("selector.attribute.substring_match");
    } else if (attribute.operator === "=" && sensitiveAttribute && !isDecorativeExactMatch(attribute)) {
      score += 1;
      reasons.add("selector.attribute.exact_match");
    }

    if (probeOperator && sensitiveAttribute && attribute.name !== "value") {
      // Substring/prefix/suffix probing of a secret-bearing custom attribute is less common than
      // direct value probing, but it is still a valid CSS exfiltration shape.
      score += 1;
    }
  }

  if (hasRepeatedProbeShape(attributes)) { score += 2; reasons.add("selector.repeated_probe_pattern"); }

  return { selector, score, reasons: [...reasons], attributes, isSensitive: score >= 3 };
}

function isSecretAttributeName(name: string): boolean {
  return SECRET_ATTRIBUTE_NAMES.has(name) || SENSITIVE_NAME_RE.test(name);
}

function hasSensitiveAttributeValue(attribute: AttributeSelectorInfo): boolean {
  if (attribute.value === null) return false;
  if (NON_SECRET_VALUE_ATTRIBUTES.has(attribute.name)) return false;
  if (attribute.name.startsWith("data-") && !isSecretAttributeName(attribute.name)) return false;
  if (attribute.name === "type") return false;
  return NAME_LIKE_ATTRIBUTES.has(attribute.name) && SENSITIVE_NAME_RE.test(attribute.value);
}

function isProbeOperator(operator: AttributeSelectorInfo["operator"]): boolean {
  return PROBE_OPERATORS.has(operator);
}

function probeScoreForAttribute(attribute: AttributeSelectorInfo, secretName: boolean, sensitiveValue: boolean, valueScore: number, secretScore: number): number {
  if (attribute.name === "value") return valueScore;
  if (secretName) return secretScore;
  if (sensitiveValue) return 2;
  return 0;
}

function isDecorativeExactMatch(attribute: AttributeSelectorInfo): boolean {
  return attribute.name === "type" || attribute.name === "class" || attribute.name.startsWith("aria-") || (attribute.name.startsWith("data-") && !isSecretAttributeName(attribute.name));
}

function hasRepeatedProbeShape(attributes: AttributeSelectorInfo[]): boolean {
  const probingAttributes = attributes.filter((attribute) => isProbeOperator(attribute.operator) && (attribute.name === "value" || isSecretAttributeName(attribute.name) || hasSensitiveAttributeValue(attribute)));
  if (probingAttributes.length < 2) return false;
  const sensitiveProbeCount = probingAttributes.filter((attribute) => attribute.name === "value" || isSecretAttributeName(attribute.name) || hasSensitiveAttributeValue(attribute)).length;
  const repeatedNames = new Set(probingAttributes.map((attribute) => attribute.name)).size < probingAttributes.length;
  return sensitiveProbeCount >= 2 || repeatedNames;
}
