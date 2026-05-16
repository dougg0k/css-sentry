export function stripCssComments(value: string): string {
  let output = "";
  let index = 0;
  let segmentStart = 0;

  while (index < value.length) {
    if (value[index] !== "/" || value[index + 1] !== "*") {
      index += 1;
      continue;
    }

    output += value.slice(segmentStart, index);
    index += 2;

    while (index < value.length && !(value[index] === "*" && value[index + 1] === "/")) {
      index += 1;
    }

    index = index < value.length ? index + 2 : value.length;
    segmentStart = index;
  }

  return output.length === 0 && segmentStart === 0 ? value : output + value.slice(segmentStart);
}

export function splitTopLevel(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === delimiter && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      parts.push(value.slice(start, index));
      start = index + delimiter.length;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

export function unquoteCssString(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return cssUnescape(trimmed.slice(1, -1));
  }
  return cssUnescape(trimmed);
}

export function cssUnescape(value: string): string {
  let output = "";
  let segmentStart = 0;
  let index = 0;

  while (index < value.length) {
    if (value[index] !== "\\") {
      index += 1;
      continue;
    }

    output += value.slice(segmentStart, index);
    index += 1;

    if (index >= value.length) {
      segmentStart = index;
      break;
    }

    const hexStart = index;
    while (index < value.length && index - hexStart < 6 && isHexDigit(value[index] ?? "")) {
      index += 1;
    }

    if (index > hexStart) {
      const rawHex = value.slice(hexStart, index);
      if (index < value.length && isCssEscapeWhitespace(value[index] ?? "")) index += 1;
      const code = Number.parseInt(rawHex, 16);
      output += Number.isFinite(code) && code !== 0 ? codePointToString(code) : "\uFFFD";
      segmentStart = index;
      continue;
    }

    output += value[index] ?? "";
    index += 1;
    segmentStart = index;
  }

  return output.length === 0 && segmentStart === 0 ? value : output + value.slice(segmentStart);
}

function isHexDigit(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}

function isCssEscapeWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";
}

function codePointToString(code: number): string {
  try { return String.fromCodePoint(code); } catch { return "\uFFFD"; }
}
