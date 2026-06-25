export const ERGON_LIQUID_CHROME_COOKIE_NAME = "ergon_liquid_chrome";

/** Cookie max-age (seconds) — keep in sync with client `document.cookie` writes. */
export const ERGON_LIQUID_CHROME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function decodeCookieValue(encoded: string): string {
  try {
    return decodeURIComponent(encoded.replace(/\+/g, " "));
  } catch {
    return encoded;
  }
}

/** Enabled when cookie is missing (matches schema default). */
export function getErgonLiquidChromeFromCookieValue(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const v = decodeCookieValue(raw).trim().toLowerCase();

  if (v === "false") return false;
  if (v === "true") return true;

  return true;
}

/** Writes ergon liquid chrome preference for SSR reads on /ergon. */
export function writeErgonLiquidChromeCookie(enabled: boolean): void {
  if (typeof document === "undefined") return;

  const value = enabled ? "true" : "false";
  document.cookie = `${ERGON_LIQUID_CHROME_COOKIE_NAME}=${value}; path=/; max-age=${ERGON_LIQUID_CHROME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Returns null if cookie absent. */
export function readErgonLiquidChromeFromDocumentCookie(): boolean | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");

  for (const part of parts) {
    const eq = part.indexOf("=");

    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();

    if (name !== ERGON_LIQUID_CHROME_COOKIE_NAME) continue;
    const raw = decodeCookieValue(part.slice(eq + 1));
    const v = raw.trim().toLowerCase();

    if (v === "true") return true;
    if (v === "false") return false;

    return null;
  }

  return null;
}
