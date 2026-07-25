import { tool } from "ai";
import { z } from "zod";

import { createRenderGenUiTool } from "@/lib/llm/gen-ui-tool";
import { GenUIBlockSchema, type GenUIBlock } from "@/lib/schemas/gen-ui";
import { GEN_UI_BLOCK_TYPES } from "@/lib/schemas/gen-ui/shared";

import type { GenUiLabAction } from "./gen-ui-lab";

export function createGenUiLabToolKit(actions: GenUiLabAction[]) {
  const renderGenUiTool = createRenderGenUiTool();

  return {
    select_gen_ui_archetype: tool({
      description:
        "Focus the Gen UI Lab on a specific structured block type. Use when the user asks to view, show, focus, or switch archetypes.",
      inputSchema: z.object({
        blockType: z.enum(GEN_UI_BLOCK_TYPES),
        viewMode: z.enum(["gallery", "focus"]).optional(),
      }),
      execute: async ({ blockType, viewMode }) => {
        const resolvedViewMode = viewMode ?? "focus";

        actions.push({ type: "select", blockType, viewMode: resolvedViewMode });

        return { blockType, viewMode: resolvedViewMode };
      },
    }),
    render_gen_ui: tool({
      description: renderGenUiTool.description ?? "Generate structured UI block content.",
      inputSchema: z.object({ block: GenUIBlockSchema }),
      execute: async ({ block }) => {
        const parsed = GenUIBlockSchema.parse(block);
        const output = (await renderGenUiTool.execute?.(
          { block: parsed },
          {} as Parameters<NonNullable<typeof renderGenUiTool.execute>>[1]
        )) as { block: GenUIBlock } | undefined;
        const resolved = output ?? { block: parsed };

        actions.push({
          type: "generate",
          blockType: resolved.block.type,
          block: resolved.block,
        });

        return resolved;
      },
    }),
  };
}
