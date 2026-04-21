const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.goog",
]);

function isIPv4Literal(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function parseIPv4Octets(host: string): number[] | null {
  if (!isIPv4Literal(host)) return null;
  const parts = host.split(".").map((p) => Number(p));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return parts;
}

/** RFC 1918 + loopback + link-local + CGNAT + reserved. */
function isBlockedIPv4(host: string): boolean {
  const o = parseIPv4Octets(host);
  if (!o) return false;
  const [a, b] = o;
  if (a === 0 || a === 127) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && o[2] === 100) return true;
  if (a === 203 && b === 0 && o[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIPv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::1") return true;
  if (h.startsWith("fe80:")) return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("ff")) return true;
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice("::ffff:".length);
    return isBlockedIPv4(v4);
  }
  return false;
}

export type SafeUrlResult =
  | { ok: true; href: string; hostname: string }
  | { ok: false; reason: string };

/**
 * Strata ingest: HTTPS only, block obvious SSRF targets (loopback, RFC1918 literals, .local, metadata hosts).
 */
export function assertSafePublicHttpsUrl(raw: string, maxLen = 2048): SafeUrlResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "URL is empty" };
  if (trimmed.length > maxLen) return { ok: false, reason: "URL is too long" };

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (u.protocol !== "https:") {
    return { ok: false, reason: "Only https URLs are allowed" };
  }

  if (u.username || u.password) {
    return { ok: false, reason: "URLs with credentials are not allowed" };
  }

  const host = u.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "Host is not allowed" };
  }

  if (host.endsWith(".local") || host.endsWith(".localhost")) {
    return { ok: false, reason: "Host is not allowed" };
  }

  if (isBlockedIPv4(host) || isBlockedIPv6(host)) {
    return { ok: false, reason: "Address is not allowed" };
  }

  return { ok: true, href: u.href, hostname: host };
}
