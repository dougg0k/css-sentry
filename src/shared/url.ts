export function getOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isPolicyOrigin(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.origin !== value) return false;
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.trim().toLowerCase();
    return host.length > 0 && host !== "null" && host !== "undefined";
  } catch {
    return false;
  }
}

export function normalizeOriginInput(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || raw === "null" || raw === "undefined") return null;

  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const origin = new URL(candidate).origin;
      return isPolicyOrigin(origin) ? origin : null;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
