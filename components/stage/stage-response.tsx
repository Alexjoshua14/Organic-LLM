"use client";

import type { StageState } from "@/lib/stage/schema";

import { Maximize2, Minimize2 } from "lucide-react";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { stageCaptionText, stageDiagramSources } from "@/lib/stage/artifacts";

type Reply = { name: string; message: StageState["messages"][number] };

/** The selected author's latest words, or what they are doing if they haven't spoken yet. */
function stageReply(state: StageState, author: string): Reply | null {
  const replies = state.messages.filter((message) => message.role === "assistant");
  const organic = replies.findLast((message) => !message.author);
  const fallback = organic ? { name: "Organic", message: organic } : null;

  if (author === "organic") return fallback;
  const said = replies.findLast((message) => message.author?.id === author);

  if (said) return { name: said.author!.name, message: said };
  const agent = state.subagents?.find((entry) => entry.id === author);
  const designer = state.design?.id === author ? state.design : null;
  const source = state.widgets.find((widget) => widget.source?.id === author)?.source;
  const name = agent?.name ?? (designer ? "Designer" : source?.name);

  if (!name) return fallback;

  return {
    name,
    message: {
      id: author,
      role: "assistant",
      text: designer
        ? `Arranging the stage: ${designer.brief}`
        : agent?.status === "working" || agent?.status === "queued"
          ? `Working on: ${agent.goal}`
          : `${name}’s work is on the stage.`,
    },
  };
}

/** One quiet reading surface: the words, and a way to give them the whole stage. */
export function StageResponse({
  state,
  selectedAuthor = "organic",
  expanded = false,
  onToggleExpanded,
}: {
  state: StageState;
  selectedAuthor?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const active = stageReply(state, selectedAuthor);

  if (!active) return null;
  const sources = stageDiagramSources(active.message.text);
  const diagramAvailable =
    sources.length > 0 &&
    sources.every((source) =>
      state.widgets.some((widget) => widget.kind === "mermaid" && widget.code === source)
    );

  return (
    <div className="stage-response">
      {onToggleExpanded && (
        <button
          aria-label={expanded ? "Return to the stage" : "Give response more room"}
          aria-pressed={expanded}
          className="stage-icon-button stage-response-expand"
          type="button"
          onClick={onToggleExpanded}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      )}
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named scroll region supports keyboard reading. */}
      <div
        key={active.message.id}
        aria-label={`${active.name}’s response`}
        className="stage-response-copy stage-prose"
        role="region"
        tabIndex={0}
      >
        <ChatMessageMarkdown
          content={stageCaptionText(active.message.text, diagramAvailable)}
          id={active.message.id}
        />
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
    </div>
  );
}
