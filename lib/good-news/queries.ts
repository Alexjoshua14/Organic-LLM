import { GoodNewsCategory } from "@/lib/schemas/good-news";

export type SeedQuery = {
  category: GoodNewsCategory;
  query: string;
};

/**
 * Seed queries spanning the optimistic-news beats we surface. Each is phrased to
 * bias Exa toward concrete, accomplished, positive developments rather than
 * opinion or speculation. The pipeline scopes every query to the past week.
 */
export const SEED_QUERIES: readonly SeedQuery[] = [
  {
    category: "health",
    query: "major medical breakthrough cancer treatment cure announced this week",
  },
  {
    category: "health",
    query: "new vaccine or disease eradication milestone reported recently",
  },
  {
    category: "climate",
    query: "renewable energy record clean power milestone reached this week",
  },
  {
    category: "climate",
    query: "company achieves carbon neutral net zero emissions milestone",
  },
  {
    category: "conservation",
    query: "endangered species population recovery conservation success this week",
  },
  {
    category: "conservation",
    query: "ecosystem restored reforestation ocean cleanup positive result",
  },
  {
    category: "conflict_resolution",
    query: "peace deal ceasefire agreement signed conflict ended this week",
  },
  {
    category: "science",
    query: "scientific discovery breakthrough first ever achievement this week",
  },
  {
    category: "technology",
    query: "technology breakthrough improves lives accessibility announced recently",
  },
  {
    category: "social_progress",
    query: "global poverty literacy child mortality improvement new data this week",
  },
  {
    category: "humanitarian",
    query: "humanitarian relief clean water access expanded successful program",
  },
];
