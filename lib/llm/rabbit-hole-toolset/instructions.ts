/**
 * System-prompt guidance for the rabbit hole toolset, per category. The create tools do not gate
 * on approval themselves; the approval rule lives here, in the agent's instructions.
 */
export type RabbitHoleToolCategory = "read" | "create";

const READ_INSTRUCTIONS = `Rabbit hole library (read):
- list_rabbit_holes: browse the user's rabbit holes, newest first.
- search_rabbit_holes: keyword search over titles, questions, takeaways and summaries. Use a few topical keywords, not a sentence.
- get_rabbit_hole: one session by id. Start at detail "high_level" (title, description, date, node graph with ids and titles); use "overview" to add key takeaways; use "detailed" only when you need the full content, because it can be very large.
- get_rabbit_hole_node: one node by id, same detail levels. Its high_level read includes a section outline.
- get_rabbit_hole_node_section: one section of an article as plain text, by index from that outline.
Read narrowly and escalate: high_level, then overview, then one node or section, then detailed. Do not quote or summarize rabbit hole content you have not read.`;

const CREATE_INSTRUCTIONS = `Rabbit hole creation:
- create_rabbit_hole starts a new session; create_rabbit_hole_node adds one article to an existing one. Both generate in the background and return a url.
- These tools do not ask the user for approval — you do. An explicit instruction ("create this as a rabbit hole", "add this to my Python rabbit hole") is approval; act on it without asking again. If you are the one suggesting a rabbit hole, say what you would create and wait for a yes first.
- Before creating a new rabbit hole, search_rabbit_holes for an existing one on the same subject. If one fits, call create_rabbit_hole_node on it, choosing parentNodeId from its graph (omit it to attach under the root), rather than starting a disconnected session. Only call create_rabbit_hole when nothing fits.
- Write query as the topic to explore: a focused question or short phrase. It is refined into a single sentence before the article is generated, so length and format directions ("keep it brief", "a cheat sheet") are not carried through. Do not promise the user a particular length or format.
- At most one creation per turn. After it succeeds, tell the user it is generating and link the url. Do not describe the article's content as if it were finished.`;

export function rabbitHoleToolsetInstructions(
  categories: readonly RabbitHoleToolCategory[]
): string {
  const parts: string[] = [];

  if (categories.includes("read")) parts.push(READ_INSTRUCTIONS);
  if (categories.includes("create")) parts.push(CREATE_INSTRUCTIONS);

  return parts.join("\n\n");
}
