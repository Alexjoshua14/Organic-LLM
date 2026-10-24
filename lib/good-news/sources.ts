import { SourceTier } from "@/lib/schemas/good-news";

/**
 * Curated allowlist of credible news/science domains.
 *
 * `HIGH_TRUST` domains are established wire services, primary scientific
 * publishers, and official institutions. A single one of these is enough to
 * surface a claim. `STANDARD` domains are reputable outlets that still require
 * corroboration from at least one other distinct domain.
 *
 * Domains are stored as registrable roots (no `www.`, no subdomain). Matching is
 * suffix-based so `apnews.com` matches `apnews.com` and `www.apnews.com`.
 */
export const HIGH_TRUST_DOMAINS: readonly string[] = [
  // Wire services
  "reuters.com",
  "apnews.com",
  "afp.com",
  // Primary science / medicine
  "nature.com",
  "science.org",
  "sciencemag.org",
  "thelancet.com",
  "nejm.org",
  "cell.com",
  "pnas.org",
  "bmj.com",
  // Official institutions / agencies
  "who.int",
  "nih.gov",
  "nasa.gov",
  "noaa.gov",
  "cdc.gov",
  "europa.eu",
  "un.org",
  "iaea.org",
  "esa.int",
  "energy.gov",
];

export const STANDARD_DOMAINS: readonly string[] = [
  "bbc.com",
  "bbc.co.uk",
  "theguardian.com",
  "npr.org",
  "pbs.org",
  "economist.com",
  "ft.com",
  "nytimes.com",
  "washingtonpost.com",
  "wsj.com",
  "bloomberg.com",
  "scientificamerican.com",
  "newscientist.com",
  "smithsonianmag.com",
  "nationalgeographic.com",
  "arstechnica.com",
  "technologyreview.com",
  "axios.com",
  "abcnews.go.com",
  "cnn.com",
  "cbsnews.com",
  "nbcnews.com",
  "aljazeera.com",
  "dw.com",
  "goodnewsnetwork.org",
  "positive.news",
  "reasonstobecheerful.world",
];

const TIER_BY_DOMAIN = new Map<string, SourceTier>([
  ...HIGH_TRUST_DOMAINS.map((d) => [d, "high_trust"] as const),
  ...STANDARD_DOMAINS.map((d) => [d, "standard"] as const),
]);

/** Every allowlisted domain, used to constrain Exa search results. */
export const ALL_ALLOWED_DOMAINS: readonly string[] = [...HIGH_TRUST_DOMAINS, ...STANDARD_DOMAINS];

/**
 * Extract the registrable root domain from a URL (lowercased, no `www.`).
 * Returns null for unparseable URLs.
 */
export function extractRootDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();

    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * Resolve the credibility tier for a URL or hostname. Matches by domain suffix
 * so subdomains (e.g. `apps.who.int`) still resolve. Returns null when the
 * domain is not on the allowlist.
 */
export function classifyUrl(url: string): SourceTier | null {
  const host = extractRootDomain(url);

  if (!host) return null;

  if (TIER_BY_DOMAIN.has(host)) {
    return TIER_BY_DOMAIN.get(host)!;
  }

  for (const [domain, tier] of TIER_BY_DOMAIN) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return tier;
    }
  }

  return null;
}

/** True when a URL belongs to any allowlisted domain. */
export function isAllowedUrl(url: string): boolean {
  return classifyUrl(url) !== null;
}
