import { USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";

import {
  ERGON_LIQUID_CHROME_COOKIE_NAME,
  ERGON_LIQUID_CHROME_COOKIE_MAX_AGE,
  readErgonLiquidChromeFromDocumentCookie,
} from "./liquid-chrome-cookie";

/**
 * Inline script: backfill ergon_liquid_chrome cookie from localStorage when missing.
 * Runs beforeInteractive on /ergon so SSR and client agree on first visit after migration.
 */
export const ERGON_LIQUID_CHROME_COOKIE_BACKFILL = `(function(){try{if(document.cookie.indexOf("${ERGON_LIQUID_CHROME_COOKIE_NAME}=")!==-1)return;var r=localStorage.getItem("${USER_SETTINGS_STORAGE_KEY}");var s=r?JSON.parse(r):{};var e=s.ergonLiquidChrome!==false;document.cookie="${ERGON_LIQUID_CHROME_COOKIE_NAME}="+(e?"true":"false")+"; path=/; max-age=${ERGON_LIQUID_CHROME_COOKIE_MAX_AGE}; SameSite=Lax";}catch(e){document.cookie="${ERGON_LIQUID_CHROME_COOKIE_NAME}=true; path=/; max-age=${ERGON_LIQUID_CHROME_COOKIE_MAX_AGE}; SameSite=Lax";}})();`;

/** One-time client migration: localStorage → cookie when cookie absent. */
export function backfillErgonLiquidChromeCookieFromSettings(): void {
  if (typeof document === "undefined") return;
  if (readErgonLiquidChromeFromDocumentCookie() !== null) return;

  try {
    const stored = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as { ergonLiquidChrome?: boolean }) : {};
    const enabled = parsed.ergonLiquidChrome !== false;
    document.cookie = `${ERGON_LIQUID_CHROME_COOKIE_NAME}=${enabled ? "true" : "false"}; path=/; max-age=${ERGON_LIQUID_CHROME_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    document.cookie = `${ERGON_LIQUID_CHROME_COOKIE_NAME}=true; path=/; max-age=${ERGON_LIQUID_CHROME_COOKIE_MAX_AGE}; SameSite=Lax`;
  }
}
