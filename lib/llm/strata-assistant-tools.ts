import { tool } from "ai";
import { z } from "zod";

import { listStrataPages } from "@/data/supabase/strata";

/**
 * Hub-side tools for the Strata list assistant (navigate + search corpus).
 */
export function createStrataHubAssistantTools(ownerId: string) {
  const navigate_to_strata_page = tool({
    description:
      "Find a Strata page and return its in-app path. Use a full page UUID or a distinctive title fragment. When multiple titles match, the tool returns candidates instead of guessing.",
    inputSchema: z.object({
      target: z.string().min(1).describe("Strata page id (UUID) or substring of the page title"),
    }),
    execute: async ({ target }) => {
      const pages = await listStrataPages({ ownerId });
      const tid = target.trim();
      const byId = pages.find((p) => p.id === tid);

      if (byId) {
        return {
          ok: true as const,
          path: `/sandbox/prototypes/strata/${byId.id}`,
          title: byId.title,
          match: "id" as const,
        };
      }
      const lower = tid.toLowerCase();
      const titleMatches = pages.filter((p) => p.title.toLowerCase().includes(lower));

      if (titleMatches.length === 1) {
        const p = titleMatches[0]!;

        return {
          ok: true as const,
          path: `/sandbox/prototypes/strata/${p.id}`,
          title: p.title,
          match: "title" as const,
        };
      }
      if (titleMatches.length > 1) {
        return {
          ok: false as const,
          message:
            "Multiple Strata pages matched that title fragment. Ask the user which one they mean, or have them pass the page UUID.",
          candidates: titleMatches.slice(0, 10).map((p) => ({ id: p.id, title: p.title })),
        };
      }

      return {
        ok: false as const,
        message: "No Strata page matched that target.",
        recent: pages.slice(0, 12).map((p) => ({ id: p.id, title: p.title })),
      };
    },
  });

  const search_strata_pages = tool({
    description:
      "Search the user's Strata pages by title or id substring (case-insensitive). Use an empty query to list recent pages.",
    inputSchema: z.object({
      query: z.string().describe("Search phrase; use empty string for recent pages"),
      limit: z.number().int().min(1).max(25).optional().default(12),
    }),
    execute: async ({ query, limit }) => {
      const pages = await listStrataPages({ ownerId });
      const q = query.trim().toLowerCase();
      const filtered =
        q.length === 0
          ? pages
          : pages.filter(
              (p) => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
            );

      return {
        results: filtered.slice(0, limit).map((p) => ({
          id: p.id,
          title: p.title,
          updated_at: p.updated_at,
        })),
        total: filtered.length,
      };
    },
  });

  return { navigate_to_strata_page, search_strata_pages };
}
