import type { OrganicState } from "@/lib/schemas/organicStateSchema";

export function getInsightsView(
  state: OrganicState,
  filterTags?: string[],
  limit = 10,
) {
  let list = state.keyInsights;

  if (filterTags?.length) {
    const set = new Set(filterTags.map((t) => t.toLowerCase()));

    list = list.filter((x) => x.tags.some((t) => set.has(t.toLowerCase())));
  }

  return list.slice(0, limit);
}
