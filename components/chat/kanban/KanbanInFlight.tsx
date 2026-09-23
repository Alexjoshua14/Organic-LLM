"use client";

/**
 * Bridges an in-flight `kanban_board` tool part onto the thread's Presence activity,
 * then renders the familiar loading chip / shell. Unmount clears the signal.
 */

import { useEffect } from "react";

import { clearKanbanActivity, setKanbanActivity } from "./living/activity-store";
import { KanbanLoadingShell } from "./KanbanLoadingShell";

import { ChatThinking } from "@/components/chat/chat-loading";
import { kanbanCommandTargets } from "@/lib/kanban/board-lanes";
import { safeParseKanbanCommand, type KanbanCommand } from "@/lib/schemas/kanban";

function commandFromInput(input: unknown): KanbanCommand | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = (input as { command?: unknown }).command;
  const parsed = safeParseKanbanCommand(raw);

  return parsed.ok ? parsed.command : undefined;
}

type KanbanInFlightProps = {
  threadId: string;
  input: unknown;
  /** INITIATE / SHOW_VIEW get the full shell; mutations stay a compact thinking row. */
  showFullShell: boolean;
  thinkingLabel: string;
};

export function KanbanInFlight({
  threadId,
  input,
  showFullShell,
  thinkingLabel,
}: KanbanInFlightProps) {
  useEffect(() => {
    const command = commandFromInput(input);

    if (!command) {
      clearKanbanActivity(threadId);

      return;
    }

    setKanbanActivity(threadId, {
      phase: "working",
      command,
      targetId: kanbanCommandTargets(command)[0],
    });

    return () => clearKanbanActivity(threadId);
  }, [threadId, input]);

  if (showFullShell) return <KanbanLoadingShell />;

  return (
    <div className="not-prose rounded-lg border border-border/40 bg-background-tertiary/20 px-3 py-2">
      <ChatThinking text={thinkingLabel} />
    </div>
  );
}
