/** Path prefixes that use liquid chrome when the page opts in (Ergon is handled separately). */
export const LIQUID_CHROME_ROUTE_PREFIXES = [
  "/showcase",
  "/status",
  "/sandbox",
  "/introspection",
] as const;

export function isLiquidChromeRoutePath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }

  if (pathname === "/ergon" || pathname.startsWith("/ergon/")) {
    return true;
  }

  return LIQUID_CHROME_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function syncErgonSsrFillVisibility(enabled: boolean): void {
  if (typeof document === "undefined") return;

  document.getElementById("ergon-liquid-chrome-ssr-fill")?.classList.toggle("hidden", !enabled);
}
