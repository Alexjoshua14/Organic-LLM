"use client";

import type { UIMessage } from "ai";
import type { useChat } from "@ai-sdk/react";
import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from "ai";

import { glass } from "@/components/design-system/primitives";
import { GENERATE_RABBIT_HOLE_NODE_TOOL_NAME } from "@/lib/llm/rabbit-hole-assistant-tools";
import { cn } from "@/lib/utils";

type RabbitHoleNodeCreationApprovalProps = {
  messages: UIMessage[];
  session: RabbitHoleSession | null;
  addToolApprovalResponse?: ReturnType<typeof useChat>["addToolOutput"];
  className?: string;
};

type PendingApproval = {
  toolCallId: string;
  query: string;
  parentLabel: string;
};

function findPendingNodeCreation(messages: UIMessage[]): PendingApproval | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];

    if (message.role !== "assistant") continue;

    for (const part of message.parts ?? []) {
      if (!isToolOrDynamicToolUIPart(part)) continue;
      if (getToolOrDynamicToolName(part) !== GENERATE_RABBIT_HOLE_NODE_TOOL_NAME) continue;

      const state = part.state as string;

      if (
        state === "approval-requested" ||
        state === "input-available" ||
        state === "input-streaming"
      ) {
        const input = "input" in part ? (part.input as { query?: string; label?: string }) : {};
        const toolCallId =
          "toolCallId" in part && typeof part.toolCallId === "string" ? part.toolCallId : "";

        if (!toolCallId) continue;

        return {
          toolCallId,
          query: input.query ?? "New exploration",
          parentLabel: input.label ?? "Current node",
        };
      }
    }
  }

  return null;
}

export function RabbitHoleNodeCreationApproval({
  messages,
  session,
  addToolApprovalResponse,
  className,
}: RabbitHoleNodeCreationApprovalProps) {
  const pending = findPendingNodeCreation(messages);

  if (!pending || !addToolApprovalResponse) return null;

  const parentNodeId = session?.activeNodeId;
  const parentLabel =
    parentNodeId && session?.nodesById[parentNodeId]?.title?.trim()
      ? session.nodesById[parentNodeId].title!
      : pending.parentLabel;

  return (
    <div
      className={cn(
        "mt-2 rounded-xl border border-border/50 px-3 py-3 text-sm",
        glass({ opaque: true }),
        className
      )}
    >
      <p className="font-commissioner text-2xs uppercase tracking-[0.2em] text-muted-foreground">
        Proposed article node
      </p>
      <p className="mt-1 font-medium text-foreground">{pending.query}</p>
      <p className="mt-1 text-xs text-muted-foreground">Parent: {parentLabel}</p>
      <div className="mt-3 flex gap-2">
        <button
          className="min-h-9 flex-1 rounded-lg bg-foreground px-3 text-xs font-medium text-background"
          type="button"
          onClick={() =>
            addToolApprovalResponse({
              tool: GENERATE_RABBIT_HOLE_NODE_TOOL_NAME,
              toolCallId: pending.toolCallId,
              output: { ok: true, approved: true },
            })
          }
        >
          Confirm
        </button>
        <button
          className="min-h-9 flex-1 rounded-lg border border-border/60 px-3 text-xs font-medium text-muted-foreground"
          type="button"
          onClick={() =>
            addToolApprovalResponse({
              tool: GENERATE_RABBIT_HOLE_NODE_TOOL_NAME,
              toolCallId: pending.toolCallId,
              output: { ok: false, error: "User declined node creation." },
            })
          }
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
