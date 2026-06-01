import { classifyUrl, extractRootDomain } from "./sources";

import { GoodNewsSource } from "@/lib/schemas/good-news";

export type CorroborationResult = {
  passed: boolean;
  highTrustDomains: string[];
  standardDomains: string[];
  /** Distinct allowlisted domains backing the claim. */
  distinctDomains: string[];
  reason: string;
};

/**
 * Decide whether a set of source URLs meets the corroboration bar:
 *   - at least one HIGH_TRUST domain, OR
 *   - at least two DISTINCT STANDARD domains.
 *
 * Only allowlisted domains count, and each domain counts once (two articles from
 * the same outlet are not independent corroboration).
 */
export function evaluateCorroboration(urls: string[]): CorroborationResult {
  const highTrust = new Set<string>();
  const standard = new Set<string>();

  for (const url of urls) {
    const tier = classifyUrl(url);
    const domain = extractRootDomain(url);

    if (!tier || !domain) continue;

    if (tier === "high_trust") {
      highTrust.add(domain);
    } else {
      standard.add(domain);
    }
  }

  const highTrustDomains = [...highTrust];
  const standardDomains = [...standard];
  const distinctDomains = [...new Set([...highTrustDomains, ...standardDomains])];

  const passed = highTrustDomains.length >= 1 || standardDomains.length >= 2;

  let reason: string;

  if (highTrustDomains.length >= 1) {
    reason = `Reported by high-trust source${highTrustDomains.length > 1 ? "s" : ""}: ${highTrustDomains.join(", ")}`;
  } else if (standardDomains.length >= 2) {
    reason = `Corroborated across ${standardDomains.length} independent sources: ${standardDomains.join(", ")}`;
  } else if (standardDomains.length === 1) {
    reason = `Only one standard source (${standardDomains[0]}); needs corroboration`;
  } else {
    reason = "No allowlisted sources";
  }

  return { passed, highTrustDomains, standardDomains, distinctDomains, reason };
}

/**
 * Build deterministic, allowlist-resolved `GoodNewsSource` records from URLs.
 *
 * Tier and domain are derived from the allowlist (never trusted from the model).
 * Non-allowlisted URLs are dropped. One source per distinct domain is kept,
 * preferring entries that carry richer metadata.
 */
export function buildVerifiedSources(
  urls: string[],
  metaByUrl: Map<string, { title?: string; publishedAt?: string }>
): GoodNewsSource[] {
  const byDomain = new Map<string, GoodNewsSource>();

  for (const url of urls) {
    const tier = classifyUrl(url);
    const domain = extractRootDomain(url);

    if (!tier || !domain) continue;

    const meta = metaByUrl.get(url);
    const candidate: GoodNewsSource = {
      url,
      domain,
      tier,
      title: meta?.title?.trim() || domain,
      publishedAt: meta?.publishedAt,
    };

    const existing = byDomain.get(domain);

    if (!existing) {
      byDomain.set(domain, candidate);
      continue;
    }

    // Prefer the entry with a real title and/or a publish date.
    const existingScore = (existing.title !== domain ? 1 : 0) + (existing.publishedAt ? 1 : 0);
    const candidateScore = (candidate.title !== domain ? 1 : 0) + (candidate.publishedAt ? 1 : 0);

    if (candidateScore > existingScore) {
      byDomain.set(domain, candidate);
    }
  }

  // High-trust domains first, then alphabetical for stable output.
  return [...byDomain.values()].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === "high_trust" ? -1 : 1;

    return a.domain.localeCompare(b.domain);
  });
}
