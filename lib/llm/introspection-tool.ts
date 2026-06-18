import { tool } from "ai";

import { saveIntrospectionGuidedState, loadIntrospectionGuidedState } from "@/data/supabase/introspection";
import { createLogger } from "@/lib/logger";
import {
  UpdateIntrospectionViewInputSchema,
  type IntrospectionGuidedState,
} from "@/lib/schemas/introspection";

const logger = createLogger("lib/llm/introspection-tool.ts");

export const UPDATE_INTROSPECTION_VIEW_TOOL_NAME = "update_introspection_view";

export type IntrospectionStreamWriter = {
  write: (part: {
    type: "data-introspection-view";
    data: IntrospectionGuidedState;
    transient?: boolean;
  }) => void;
};

export function createUpdateIntrospectionViewTool({
  chatId,
  sbUserId,
  writer,
}: {
  chatId: string;
  sbUserId: string;
  writer?: IntrospectionStreamWriter;
}) {
  return tool({
    description:
      "Update the stable Introspection overview canvas and navigation state. Put primary content here instead of long chat prose. Call when changing steps, overview summary, or breadcrumbs.",
    inputSchema: UpdateIntrospectionViewInputSchema,
    execute: async (input) => {
      const existing = (await loadIntrospectionGuidedState(chatId, sbUserId)) ?? {
        overviewMarkdown: "",
        breadcrumb: ["Introspection"],
        stepComplete: false,
      };

      const next: IntrospectionGuidedState = {
        ...existing,
        overviewMarkdown: input.overviewMarkdown,
        currentStepId: input.stepId ?? existing.currentStepId,
        breadcrumb: input.breadcrumb ?? existing.breadcrumb,
        stepComplete: input.stepComplete ?? existing.stepComplete,
      };

      const saveResult = await saveIntrospectionGuidedState(chatId, sbUserId, next);

      if (!saveResult.ok) {
        logger.error("update_introspection_view", saveResult.error?.message ?? "save failed");

        return { ok: false as const, error: "Failed to persist view state" };
      }

      writer?.write({ type: "data-introspection-view", data: next, transient: true });

      logger.log("update_introspection_view", "view updated", {
        stepId: next.currentStepId,
        breadcrumbLength: next.breadcrumb.length,
      });

      return { ok: true as const, applied: true };
    },
  });
}
