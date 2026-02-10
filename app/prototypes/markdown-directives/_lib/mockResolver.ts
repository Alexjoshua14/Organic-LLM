/**
 * Simulates async data resolution for directive props. In production this would
 * call a real API (e.g. vector search for knowledge-card). Here we return
 * static mock data keyed by query/view so components can render something.
 */

export type ResolvedData = Record<string, unknown>;

const MOCK_KNOWLEDGE: Record<string, ResolvedData> = {
  "project alpha deadlines": {
    title: "Project Alpha",
    items: [
      { label: "Design review", date: "2025-02-15" },
      { label: "Sprint end", date: "2025-02-28" },
    ],
  },
  default: {
    title: "Knowledge",
    items: [{ label: "Sample item", date: "—" }],
  },
};

const MOCK_TIMELINE: Record<string, ResolvedData> = {
  timeline: {
    events: [
      { at: "10:00", text: "Standup" },
      { at: "14:00", text: "Review" },
    ],
  },
  default: { events: [{ at: "—", text: "No events" }] },
};

const MOCK_TABLE: ResolvedData = {
  columns: ["Name", "Status"],
  rows: [
    ["Task A", "Done"],
    ["Task B", "In progress"],
  ],
};

/**
 * Resolves data for a directive. Uses props.query or props.view to pick mock data.
 * In MVP we simulate a short delay to mimic async fetch.
 */
export async function resolveDirectiveData(
  directiveName: string,
  props: Record<string, string | number | boolean | undefined>
): Promise<ResolvedData> {
  await new Promise((r) => setTimeout(r, 50));
  const query = String(props.query ?? props.view ?? "default").toLowerCase();

  switch (directiveName) {
    case "knowledge-card":
      return MOCK_KNOWLEDGE[query] ?? MOCK_KNOWLEDGE.default;
    case "timeline":
      return MOCK_TIMELINE[query] ?? MOCK_TIMELINE.default;
    case "data-table":
      return MOCK_TABLE;
    default:
      return { placeholder: true, name: directiveName };
  }
}
