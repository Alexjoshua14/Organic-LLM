import type { StrataPageWithSections } from "@/lib/schemas/strata";

const trunc = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max)}…`;

const STRATA_HUB_SYSTEM_APPEND =
  "\n\n[Strata hub mode]\nYou help the user browse and manage Strata pages (structured documents). Prefer concise answers. When the user wants to open a page, call navigate_to_strata_page and give them the returned path as a markdown link. Use search_strata_pages to explore their Strata corpus by topic or keyword.";

/**
 * Shared Strata system prompt suffix for hub + page grounding (main `/api/chat` and Aion).
 * Pass `fetchPage` from a Server context (e.g. `getStrataPageById`); avoids importing `"use server"` data modules here.
 */
export async function buildStrataSystemSuffix({
  experience,
  strataPageId,
  sbUserId,
  fetchPage,
}: {
  experience?: string;
  strataPageId?: string;
  sbUserId: string;
  fetchPage: (pageId: string) => Promise<StrataPageWithSections | null>;
}): Promise<string> {
  let suffix = "";

  if (experience === "strata_hub") {
    suffix += STRATA_HUB_SYSTEM_APPEND;
  }

  if (experience === "strata_page" && strataPageId) {
    const full = await fetchPage(strataPageId);

    if (full && full.page.owner_id === sbUserId) {
      const { page, sections } = full;

      suffix += `\n\n[Strata page grounding — read only]\nTitle: ${page.title}\nId: ${page.id}\n\nRaw:\n${trunc(sections.raw_text.content, 8000)}\n\nRefined:\n${trunc(sections.refined_text.content, 6000)}\n\nElaborated:\n${trunc(sections.elaborated.content, 8000)}\n\nDesign instructions:\n${trunc(sections.design_instructions.content, 3000)}\n\nAI instructions:\n${trunc(sections.ai_instructions.content, 3000)}\n\nThe editor saves changes automatically; do not imply you edited stored content unless you are quoting what the user already has.`;
    }
  }

  return suffix;
}
