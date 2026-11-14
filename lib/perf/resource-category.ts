/**
 * Sorts a network request into a coarse, closed category. This runs in the browser and is the
 * only place a request URL is ever read: what leaves the browser is a category name, never a
 * host, a path, a query string or an id. Anything unrecognised falls into `other` or
 * `third-party`.
 */

export const PERF_RESOURCE_CATEGORIES = [
  "font",
  "script",
  "css",
  "clerk",
  "rsc",
  "api-stream-resume",
  "api-messages",
  "api-sidebar",
  "api-usage",
  "api-other",
  "image",
  "third-party",
  "other",
] as const;
export type PerfResourceCategory = (typeof PERF_RESOURCE_CATEGORIES)[number];

const FONT_EXT = /\.(woff2?|ttf|otf)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i;

export function classifyResource(name: string, origin: string): PerfResourceCategory {
  let url: URL;

  try {
    url = new URL(name, origin);
  } catch {
    return "other";
  }

  const path = url.pathname;

  if (url.origin !== origin) {
    const host = url.hostname.toLowerCase();

    if (host.includes("clerk")) return "clerk";
    if (
      FONT_EXT.test(path) ||
      host.endsWith("fonts.gstatic.com") ||
      host.endsWith("fonts.googleapis.com")
    ) {
      return "font";
    }

    return "third-party";
  }

  if (FONT_EXT.test(path)) return "font";
  // Next's page payload for a client navigation.
  if (url.searchParams.has("_rsc")) return "rsc";
  if (/\.css$/i.test(path)) return "css";
  if (/\.m?js$/i.test(path)) return "script";

  if (path.startsWith("/api/")) {
    if (/^\/api\/chat\/[^/]+\/stream\/?$/.test(path)) return "api-stream-resume";
    if (/^\/api\/chat\/[^/]+\/(?:arcadia\/)?messages\/?$/.test(path)) return "api-messages";
    if (/^\/api\/chats(?:\/|$)/.test(path)) return "api-sidebar";
    if (/^\/api\/usage(?:\/|$)/.test(path)) return "api-usage";

    return "api-other";
  }

  if (path.startsWith("/_next/image") || IMAGE_EXT.test(path)) return "image";

  return "other";
}
