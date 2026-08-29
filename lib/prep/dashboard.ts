export const REMY_MODES = ["week", "library", "shopping"] as const;
export type RemyMode = (typeof REMY_MODES)[number];

export function parseRemyMode(raw: string | null | undefined): RemyMode {
  if (raw === "library" || raw === "shopping") return raw;

  return "week";
}

export function remyDashboardQuery(weekStart: string, mode: RemyMode): string {
  const params = new URLSearchParams();

  params.set("week", weekStart);
  if (mode !== "week") params.set("mode", mode);

  return params.toString();
}

export function remyDashboardHref(weekStart: string, mode: RemyMode): string {
  return `/remy?${remyDashboardQuery(weekStart, mode)}`;
}
