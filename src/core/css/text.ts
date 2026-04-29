export function stripCssComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
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
  return value.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_match, escaped: string) => {
    const hex = /^[0-9a-fA-F]/.test(escaped);
    if (!hex) return escaped;
    const code = Number.parseInt(escaped.trim(), 16);
    if (!Number.isFinite(code) || code === 0) return "\uFFFD";
    try { return String.fromCodePoint(code); } catch { return "\uFFFD"; }
  });
}

