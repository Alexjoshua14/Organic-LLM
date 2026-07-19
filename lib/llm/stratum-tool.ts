import { tool } from "ai";
import { z } from "zod";

import { createLogger } from "@/lib/logger";
import {
  StratumFormSchema,
  StratumSpecSchema,
  type StratumForm,
  type StratumFormToolOutput,
  type StratumSpecToolOutput,
} from "@/lib/schemas/stratum";

const logger = createLogger("lib/llm/stratum-tool.ts");

export const STRATUM_FORM_TOOL_NAME = "discovery_form";
export const STRATUM_SPEC_TOOL_NAME = "product_spec";

/**
 * Renders one round of discovery questions as an interactive form in the thread.
 * Stateless echo (like render_gen_ui): the client hydrates the output block; the
 * user's answers come back as their next message.
 */
export function createDiscoveryFormTool() {
  let callsThisTurn = 0;
  let firstForm: StratumForm | null = null;

  return tool({
    description:
      "Render an interactive discovery form in the chat thread to ask the user structured questions about their product idea. Use at most once per assistant turn, with 2-4 fields mixing kinds (text, long_text, single_select, multi_select, scale). The user's answers arrive as their next message.",
    inputSchema: z.object({ form: StratumFormSchema }),
    execute: async ({ form }): Promise<StratumFormToolOutput> => {
      callsThisTurn += 1;

      if (callsThisTurn > 1 && firstForm) {
        logger.warn("discovery_form", "maxCallsPerTurn exceeded", {
          event: "stratum_form_max_calls_exceeded",
          stage: form.stage,
          callIndex: callsThisTurn,
        });

        return { kind: "stratum-form", form: firstForm };
      }

      firstForm = form;

      logger.log("discovery_form", "form emitted", {
        event: "stratum_form_rendered",
        stage: form.stage,
        fieldCount: form.fields.length,
        fieldKinds: form.fields.map((f) => f.kind),
      });

      return { kind: "stratum-form", form };
    },
  });
}

/** Renders/refreshes the living product spec sheet. Always receives the full spec. */
export function createProductSpecTool() {
  return tool({
    description:
      "Render the living product spec sheet in the chat thread. Pass the complete spec every time (it replaces the previous sheet). Include prioritized features (must/should/could), architecture components and data flows, risks, open questions, a 0-100 coverage estimate, and self-contained handoff chunks the user can paste into another tool.",
    inputSchema: z.object({ spec: StratumSpecSchema }),
    execute: async ({ spec }): Promise<StratumSpecToolOutput> => {
      logger.log("product_spec", "spec emitted", {
        event: "stratum_spec_rendered",
        featureCount: spec.features.length,
        handoffCount: spec.handoffs.length,
        coverage: spec.coverage,
      });

      return { kind: "stratum-spec", spec };
    },
  });
}
