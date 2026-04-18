export const SIDEBAR_COOKIE_NAME = "sidebar_state";

/** Cookie max-age (seconds) — keep in sync with client `document.cookie` writes. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function decodeCookieValue(encoded: string): string {
  try {
    return decodeURIComponent(encoded.replace(/\+/g, " "));
  } catch {
    return encoded;
  }
}

/**
 * Desktop sidebar expanded when cookie is missing or not a boolean string.
 * Matches values written by `SidebarProvider` (`true` / `false`).
 */
export function getSidebarDefaultOpenFromCookieValue(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const v = decodeCookieValue(raw).trim().toLowerCase();
  if (v === "false") return false;
  if (v === "true") return true;
  return true;
}

/**
 * Reads `sidebar_state` from `document.cookie`. Returns `null` if absent.
 */
export function readSidebarOpenFromDocumentCookie(): boolean | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== SIDEBAR_COOKIE_NAME) continue;
    const raw = decodeCookieValue(part.slice(eq + 1));
    const v = raw.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  }
  return null;
}
