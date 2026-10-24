import { GoodNewsDigest } from "@/lib/schemas/good-news";

/**
 * A realistic sample digest used for local UI preview only (rendered via
 * `/good-news?preview=1` in non-production). Sources point at real allowlisted
 * domains so the verification chips render correctly, but the items are
 * illustrative and NOT a verified digest.
 */
export const PREVIEW_DIGEST: GoodNewsDigest = {
  date: new Date().toISOString().slice(0, 10),
  generatedAt: new Date().toISOString(),
  model: "preview/sample",
  meta: { preview: true },
  items: [
    {
      rank: 1,
      headline: "Malaria vaccine rollout reaches 10 million children across Africa",
      summary:
        "Health authorities confirmed that a malaria vaccination program has now reached ten million children, with early data showing a sharp drop in severe cases.",
      whyItMatters:
        "Malaria still kills hundreds of thousands of children each year; broad vaccine access could prevent a large share of those deaths.",
      category: "health",
      confidence: 0.95,
      verification:
        "Reported by high-trust sources: who.int, reuters.com. Trial data corroborated.",
      publishedAt: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10),
      sources: [
        {
          title: "WHO: malaria vaccine program milestone",
          url: "https://www.who.int/news/malaria-vaccine-milestone",
          domain: "who.int",
          tier: "high_trust",
          publishedAt: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10),
        },
        {
          title: "Vaccine reaches millions of children",
          url: "https://www.reuters.com/business/healthcare/malaria-vaccine",
          domain: "reuters.com",
          tier: "high_trust",
        },
      ],
    },
    {
      rank: 2,
      headline: "Country generates 100% of its electricity from renewables for a full month",
      summary:
        "Grid operators reported that the nation ran entirely on solar, wind, and hydro power for thirty consecutive days for the first time.",
      whyItMatters:
        "It demonstrates that a modern grid can sustain itself on clean energy, accelerating confidence in the global transition.",
      category: "climate",
      confidence: 0.88,
      verification:
        "Corroborated across 2 independent sources: bbc.com, theguardian.com. Grid data confirmed.",
      publishedAt: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10),
      sources: [
        {
          title: "A month on 100% renewable power",
          url: "https://www.bbc.com/news/science-environment-renewables",
          domain: "bbc.com",
          tier: "standard",
        },
        {
          title: "Grid runs entirely on clean energy",
          url: "https://www.theguardian.com/environment/renewable-record",
          domain: "theguardian.com",
          tier: "standard",
        },
      ],
    },
    {
      rank: 3,
      headline: "Once-endangered humpback whale population rebounds to near pre-whaling levels",
      summary:
        "A long-term survey found that a regional humpback whale population has recovered to roughly 90% of its historic size.",
      whyItMatters:
        "It is one of the clearest conservation success stories of the decade and validates decades of protection efforts.",
      category: "conservation",
      confidence: 0.9,
      verification: "Reported by high-trust source: nature.com. Peer-reviewed survey.",
      publishedAt: new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10),
      sources: [
        {
          title: "Humpback whale recovery study",
          url: "https://www.nature.com/articles/humpback-recovery",
          domain: "nature.com",
          tier: "high_trust",
        },
      ],
    },
    {
      rank: 4,
      headline: "Neighboring nations sign peace agreement ending a decade-long border conflict",
      summary:
        "After months of negotiations, two countries signed a comprehensive peace deal that includes a permanent ceasefire and demilitarized border.",
      whyItMatters:
        "The agreement ends years of fighting and reopens trade and family ties for millions of people.",
      category: "conflict_resolution",
      confidence: 0.86,
      verification: "Reported by high-trust sources: apnews.com, un.org.",
      publishedAt: new Date(Date.now() - 1 * 864e5).toISOString().slice(0, 10),
      sources: [
        {
          title: "Peace deal signed",
          url: "https://apnews.com/article/peace-agreement-border",
          domain: "apnews.com",
          tier: "high_trust",
        },
        {
          title: "UN welcomes ceasefire",
          url: "https://www.un.org/en/peace-agreement",
          domain: "un.org",
          tier: "high_trust",
        },
      ],
    },
    {
      rank: 5,
      headline:
        "Researchers demonstrate a low-cost device that pulls clean drinking water from air",
      summary:
        "A team unveiled a solar-powered device that harvests several liters of safe drinking water per day from humidity, even in arid regions.",
      whyItMatters:
        "Affordable atmospheric water generation could help communities facing chronic water scarcity.",
      category: "technology",
      confidence: 0.82,
      verification: "Corroborated across 2 independent sources: science.org, technologyreview.com.",
      publishedAt: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10),
      sources: [
        {
          title: "Water-from-air device",
          url: "https://www.science.org/doi/water-harvesting",
          domain: "science.org",
          tier: "high_trust",
        },
        {
          title: "Cheap device makes water from air",
          url: "https://www.technologyreview.com/water-harvesting-device",
          domain: "technologyreview.com",
          tier: "standard",
        },
      ],
    },
    {
      rank: 6,
      headline: "Global child mortality falls to a record low, new data shows",
      summary:
        "Newly released figures show the number of children dying before age five has reached the lowest level ever recorded.",
      whyItMatters:
        "It reflects sustained progress in vaccines, nutrition, and maternal care reaching the world's most vulnerable families.",
      category: "social_progress",
      confidence: 0.91,
      verification: "Reported by high-trust source: who.int. Corroborated by npr.org.",
      publishedAt: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
      sources: [
        {
          title: "Child mortality at record low",
          url: "https://www.who.int/news/child-mortality-record-low",
          domain: "who.int",
          tier: "high_trust",
        },
        {
          title: "Fewer children dying worldwide",
          url: "https://www.npr.org/health/child-mortality",
          domain: "npr.org",
          tier: "standard",
        },
      ],
    },
  ],
};
