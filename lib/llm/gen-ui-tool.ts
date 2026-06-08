import { tool } from "ai";
import { z } from "zod";

import { createLogger } from "@/lib/logger";
import { GenUIBlockSchema, type GenUIBlock } from "@/lib/schemas/gen-ui";

const logger = createLogger("lib/llm/gen-ui-tool.ts");

export const RENDER_GEN_UI_TOOL_NAME = "render_gen_ui";

export function createRenderGenUiTool() {
  let callsThisTurn = 0;
  let firstBlock: GenUIBlock | null = null;

  return tool({
    description:
      "Render a structured UI block in the chat thread. Use at most once per assistant turn when a structured block clearly helps. Pass the block as `block`. Types: answer-card (multi-point answers), decision-matrix (comparisons), plan-timeline (sequential plans), audio-snippet (listen/recap requests only). Respect schema size caps.",
    inputSchema: z.object({ block: GenUIBlockSchema }),
    execute: async ({ block }) => {
      callsThisTurn += 1;

      if (callsThisTurn > 1) {
        logger.warn("render_gen_ui", "maxCallsPerTurn exceeded", {
          event: "gen_ui_max_calls_exceeded",
          type: block.type,
          callIndex: callsThisTurn,
        });
        if (firstBlock) {
          return { block: firstBlock };
        }
      }

      firstBlock = block;

      const blockSizeBytes = JSON.stringify(block).length;

      logger.log(
        "render_gen_ui",
        "[render_gen_ui] -- Knowledge Graph Connection not yet established. To do",
        {
          event: "gen_ui_rendered",
          type: block.type,
          blockSizeBytes,
          hadPartialFailures: false,
          callIndex: callsThisTurn,
        }
      );

      return { block };
    },
  });
}
