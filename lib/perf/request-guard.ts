/**
 * Cross-site guard for the perf routes. Browsers attach cookies to cross-site requests, so a
 * signed-in user's session alone does not prove the page that sent a request is ours. Browsers
 * always send `Sec-Fetch-Site` and, for POST/PUT, `Origin`; a request that fails either check is
 * refused. A client that sends neither (a script, not a browser) is allowed through to the normal
 * session check, since it cannot ride on someone else's cookies.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");

  if (site && site !== "same-origin" && site !== "none") return false;

  const origin = request.headers.get("origin");

  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

    try {
      if (!host || new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }

  return true;
}
