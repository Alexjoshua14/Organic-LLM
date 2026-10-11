import type { ToolSet, UIMessage } from "ai";
import type { SubagentThreadRow } from "@/lib/llm/subagents/threads/snapshot";

import { tool } from "ai";
import { z } from "zod";

import { resolveSubagentIdentity } from "@/lib/arcadia/multitask/subagent-identity";
import { uiMessageText } from "@/lib/llm/subagents/threads/messages";
import { resolveEffectiveSubagentStatus } from "@/lib/llm/subagents/threads/status";

/** Ceiling on messages returned per call. */
export const READ_SUBAGENT_THREAD_MAX_MESSAGES = 40;
const READ_SUBAGENT_THREAD_DEFAULT_MESSAGES = 20;
/** Total text returned per call — keeps one thread from flooding the orchestrator's context. */
export const READ_SUBAGENT_THREAD_MAX_CHARS = 16_000;

export type ReadSubagentThreadDeps = {
  /** Children of the orchestrator thread, scoped to its owner. The only threads readable. */
  listChildren(parentThreadId: string): Promise<SubagentThreadRow[]>;
  loadMessages(threadId: string, limit: number): Promise<UIMessage[]>;
};

export const READ_SUBAGENT_THREAD_TOOL_INSTRUCTIONS =
  "Use read_subagent_thread to read a subagent's own thread when its status summary is not enough — for example to quote its result or check what it was asked. Pass the agentId (or name) from [Subagent threads]; call it with no agentId to list subagents and their status. Message ids it returns can pin a specific reply as subagent_output context.";

const ReadSubagentThreadInputSchema = z.object({
  agentId: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe("agentId or name of the subagent whose thread to read. Omit to list subagents."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(READ_SUBAGENT_THREAD_MAX_MESSAGES)
    .optional()
    .describe(`Most recent messages to return (default ${READ_SUBAGENT_THREAD_DEFAULT_MESSAGES}).`),
});

/** Newest-last messages trimmed from the oldest end until they fit the character budget. */
export function capThreadTranscript<T extends { role: string; text: string }>(
  messages: ReadonlyArray<T>,
  maxChars = READ_SUBAGENT_THREAD_MAX_CHARS
): { messages: T[]; truncated: boolean } {
  const kept: T[] = [];
  let used = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    const remaining = maxChars - used;

    if (remaining <= 0) break;
    const text =
      message.text.length > remaining ? `…${message.text.slice(-(remaining - 1))}` : message.text;

    kept.unshift({ ...message, text });
    used += text.length;
  }

  return { messages: kept, truncated: kept.length < messages.length || used >= maxChars };
}

/**
 * Orchestrator-only tool: read one of *its own* subagents' threads. Subagent threads never get
 * this tool, which is what keeps each subagent confined to its own thread.
 */
export function createReadSubagentThreadTool(args: {
  orchestratorThreadId: string;
  deps: ReadSubagentThreadDeps;
  now?: () => number;
}) {
  const now = args.now ?? Date.now;

  return tool({
    description:
      "Read messages from one of your subagents' own threads (assignments and their replies), or list your subagents and their status when agentId is omitted.",
    inputSchema: ReadSubagentThreadInputSchema,
    execute: async ({ agentId, limit }) => {
      const children = await args.deps.listChildren(args.orchestratorThreadId);
      const describe = (row: SubagentThreadRow) => {
        const identity = resolveSubagentIdentity(row.agentId);

        return {
          agentId: row.agentId,
          name: identity.name,
          role: identity.role,
          status: resolveEffectiveSubagentStatus(row.status, row.statusAt, now()),
        };
      };

      if (!agentId) {
        return { success: true, subagents: children.map(describe) };
      }

      const wanted = agentId.trim().toLowerCase();
      const row = children.find(
        (c) =>
          c.agentId.toLowerCase() === wanted ||
          resolveSubagentIdentity(c.agentId).name.toLowerCase() === wanted
      );

      if (!row) {
        return {
          success: false,
          error: `No subagent thread for "${agentId}" under this orchestrator.`,
          subagents: children.map(describe),
        };
      }

      const messages = await args.deps.loadMessages(
        row.threadId,
        limit ?? READ_SUBAGENT_THREAD_DEFAULT_MESSAGES
      );
      const transcript = capThreadTranscript(
        messages
          .map((m) => ({ id: m.id, role: m.role, text: uiMessageText(m) }))
          .filter((m) => m.text.length > 0)
      );

      return {
        success: true,
        ...describe(row),
        truncated: transcript.truncated,
        messages: transcript.messages,
      };
    },
  });
}

/** Merge the reader into a compiled toolset for an orchestrator turn. */
export function withReadSubagentThreadTool(
  compiled: { tools: ToolSet; toolInstructions: string },
  args: { orchestratorThreadId: string; deps: ReadSubagentThreadDeps }
): { tools: ToolSet; toolInstructions: string } {
  return {
    tools: { ...compiled.tools, read_subagent_thread: createReadSubagentThreadTool(args) },
    toolInstructions: [compiled.toolInstructions, READ_SUBAGENT_THREAD_TOOL_INSTRUCTIONS]
      .filter(Boolean)
      .join("\n"),
  };
}
