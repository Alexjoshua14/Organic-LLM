/** Tool instructions appendix for Ergon linked documents (`ergon_document`). */
export const ERGON_DOCUMENT_TOOL_INSTRUCTIONS = `
Ergon linked documents (ergon_document): durable markdown docs tied to kanban ticket ids.

When to use:
- When a ticket needs a spec, brief, checklist, or longer write-up that should live with the board.
- When the user asks to draft, update, or open a document for a ticket.

Commands:
- CREATE_DOCUMENT { itemId, title, content } — link a new doc to an existing kanban item id.
- UPDATE_DOCUMENT { documentId, title?, content } — replace content in place (version bumps).
- READ_DOCUMENT { documentId } — fetch content for your reasoning (UI stays collapsed).
- OPEN_DOCUMENT { documentId } — show the doc in the thread viewer.

Rules:
- Always link to an existing kanban item id (from UPSERT_ITEMS / the board state).
- Prefer UPDATE_DOCUMENT over creating duplicates for the same ticket topic.
- Keep assistant prose short; the document viewer is the surface.
- Respect caps (title ≤160 chars, content ≤40k chars, ≤5 docs per ticket).
`.trim();
