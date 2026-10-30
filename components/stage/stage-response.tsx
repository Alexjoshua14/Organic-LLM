"use client";

import type { StageState } from "@/lib/stage/schema";

import { useState } from "react";
import { ArrowUpRight, Maximize2, Minimize2 } from "lucide-react";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { stageCaptionText, stageDiagramSources } from "@/lib/stage/artifacts";

/** One reading surface, explicit authors, and quiet arrival signals rather than competing cards. */
export function StageResponse({
  state,
  onOpenConversation,
  selectedAuthor,
  onSelectAuthor,
  expanded = false,
  onToggleExpanded,
  compact = false,
}: {
  state: StageState;
  onOpenConversation: () => void;
  selectedAuthor?: string;
  onSelectAuthor?: (id: string) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState("organic");
  const [read, setRead] = useState<Record<string, string>>({});
  const messages = state.messages.filter((message) => message.role === "assistant");
  const organic = messages.findLast((message) => !message.author);
  const authors = new Map<string, (typeof messages)[number]>();

  for (const message of messages)
    if (message.author) {
      authors.delete(message.author.id);
      authors.set(message.author.id, message);
    }
  const outputs = [
    ...(organic ? [{ key: "organic", name: "Organic", message: organic }] : []),
    ...[...authors.values()]
      .slice(-2)
      .map((message) => ({ key: message.author!.id, name: message.author!.name, message })),
  ];

  if (selectedAuthor && !outputs.some((o) => o.key === selectedAuthor)) {
    const agent = state.subagents?.find((a) => a.id === selectedAuthor);
    const designer = state.design?.id === selectedAuthor ? state.design : null;
    const name = agent?.name ?? (designer ? "Designer" : null);

    if (name)
      outputs.push({
        key: selectedAuthor,
        name,
        message: {
          id: selectedAuthor,
          role: "assistant",
          text: designer ? `Arranging the stage: ${designer.brief}` : `Working on: ${agent!.goal}`,
        },
      });
  }
  const active =
    outputs.find((output) => output.key === (selectedAuthor ?? selected)) ?? outputs[0];

  if (!active) return null;
  const sources = stageDiagramSources(active.message.text);
  const diagramAvailable =
    sources.length > 0 &&
    sources.every((source) =>
      state.widgets.some((widget) => widget.kind === "mermaid" && widget.code === source)
    );

  return (
    <div className="stage-response">
      <div aria-label="Response authors" className="stage-response-authors" role="group">
        {outputs.map((output) => (
          <button
            key={output.key}
            type="button"
            aria-pressed={active.key === output.key}
            className="stage-response-author"
            onClick={() => {
              setSelected(output.key);
              onSelectAuthor?.(output.key);
              setRead((current) => ({ ...current, [output.key]: output.message.id }));
            }}
          >
            {output.name}
            {output.key !== "organic" &&
            output.key !== active.key &&
            read[output.key] !== output.message.id ? (
              <span className="stage-response-new">New</span>
            ) : null}
          </button>
        ))}
        {onToggleExpanded && (
          <button
            aria-label={expanded ? "Return to stage pieces" : "Give response more room"}
            aria-pressed={expanded}
            className="stage-icon-button"
            type="button"
            onClick={onToggleExpanded}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
        <button
          aria-label="Read full conversation"
          className="stage-icon-button"
          type="button"
          onClick={onOpenConversation}
        >
          <ArrowUpRight aria-hidden size={14} />
        </button>
      </div>
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named scroll region supports keyboard reading. */}
      {!compact && (
        <div
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
      )}
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
    </div>
  );
}
