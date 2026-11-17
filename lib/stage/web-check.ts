import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { isEmbeddableStageUrl } from "./web-url";

export type StageWebCheck = { embeddable: boolean; host: string; title: string | null };

const TIMEOUT_MS = 4_000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 32_768;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; result: StageWebCheck }>();

function privateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();

    return (
      a === "::1" ||
      a === "::" ||
      a.startsWith("fc") ||
      a.startsWith("fd") ||
      a.startsWith("fe80") ||
      a.startsWith("::ffff:")
    );
  }
  const [a, b] = address.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function publicHost(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });

    return addresses.length > 0 && addresses.every(({ address }) => !privateAddress(address));
  } catch {
    return false;
  }
}

/** True when the page's own headers allow a third-party frame. Their policy, not ours, decides. */
function framingAllowed(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options")?.toLowerCase();

  if (xfo && (xfo.includes("deny") || xfo.includes("sameorigin") || xfo.includes("allow-from")))
    return false;
  const ancestors = /frame-ancestors([^;]*)/i.exec(headers.get("content-security-policy") ?? "");

  return !ancestors || /(^|\s)(\*|https:)(\s|$)/.test(ancestors[1]);
}

async function readTitle(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();

  if (!reader) return null;
  let html = "";
  let bytes = 0;
  const decoder = new TextDecoder();

  while (bytes < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();

    if (done) break;
    bytes += value.length;
    html += decoder.decode(value, { stream: true });
    if (/<\/title>/i.test(html)) break;
  }
  void reader.cancel().catch(() => undefined);
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);

  return match ? match[1].replace(/\s+/g, " ").trim().slice(0, 120) || null : null;
}

/** Never throws. Anything unreachable or unsafe counts as not embeddable. */
export async function checkStageWeb(url: string, ownHost: string | null): Promise<StageWebCheck> {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  const refused: StageWebCheck = { embeddable: false, host, title: null };
  const cached = cache.get(url);

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;
  if (!isEmbeddableStageUrl(url) || host === ownHost) return refused;

  let current = url;
  let result = refused;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = new URL(current);

      // Each hop is vetted, so a redirect can't carry the request into a private network.
      if (!isEmbeddableStageUrl(current) || target.hostname === ownHost) break;
      if (!(await publicHost(target.hostname))) break;
      const response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; StageEmbedCheck)" },
      });
      const location = response.headers.get("location");

      if (response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      result = {
        embeddable: response.ok && framingAllowed(response.headers),
        host,
        title: await readTitle(response),
      };
      break;
    }
  } catch {
    result = refused;
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(url, { at: Date.now(), result });

  return result;
}
