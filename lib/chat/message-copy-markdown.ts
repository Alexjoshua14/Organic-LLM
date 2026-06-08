import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart, type UIMessage } from "ai";

import {
  extractGenUIBlockFromToolOutput,
  genUIBlockToMarkdown,
  genUIBlockToMarkdownLoose,
  safeParseGenUIBlock,
} from "@/lib/schemas/gen-ui";
import { RENDER_GEN_UI_TOOL_NAME } from "@/lib/llm/gen-ui-tool";
import { KANBAN_BOARD_TOOL_NAME } from "@/lib/llm/kanban-tool";
import { extractKanbanViewFromToolOutput, kanbanViewToMarkdown } from "@/lib/schemas/kanban";

/**
 * Builds copy-friendly markdown for an entire assistant message, including gen-UI tool blocks.
 */
export function messagePartsToCopyMarkdown(parts: UIMessage["parts"]): string {
  const sections: string[] = [];

  for (const part of parts) {
    if (part.type === "text" && "text" in part && typeof part.text === "string") {
      const t = part.text.trim();

      if (t) sections.push(t);
      continue;
    }

    if (isToolOrDynamicToolUIPart(part)) {
      const toolName = getToolOrDynamicToolName(part);

      if (part.state !== "output-available") continue;

      if (toolName === KANBAN_BOARD_TOOL_NAME) {
        const view = extractKanbanViewFromToolOutput(part.output);

        if (view) sections.push(kanbanViewToMarkdown(view));
        continue;
      }

      if (toolName !== RENDER_GEN_UI_TOOL_NAME) continue;

      const raw = extractGenUIBlockFromToolOutput(part.output);
      const parsed = safeParseGenUIBlock(raw);

      if (parsed.ok) {
        sections.push(genUIBlockToMarkdown(parsed.block));
      } else {
        sections.push(genUIBlockToMarkdownLoose(raw));
      }
    }
  }

  return sections.join("\n\n").trim();
}
