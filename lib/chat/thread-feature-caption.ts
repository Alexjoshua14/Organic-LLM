function titleCaseWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Human-facing label for thread `feature` (Settings Chats caption, sort key). */
export function getThreadFeatureCaption(feature: string | null | undefined): string {
  const raw = (feature ?? "main").trim();
  const normalized = raw === "" ? "main" : raw;

  if (normalized === "main") return "chat";
  if (normalized === "topic_explore") return "noesis";
  if (normalized === "arcadia") return "arcadia";

  const humanized = normalized.replace(/_/g, " ");

  return titleCaseWords(humanized);
}
