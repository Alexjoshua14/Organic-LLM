"use client";

import type { StageState } from "@/lib/stage/schema";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { stageCaptionText, stageDiagramSources } from "@/lib/stage/artifacts";

/** One reading surface, explicit authors, and quiet arrival signals rather than competing cards. */
export function StageResponse({
  state,
  onOpenConversation,
}: {
  state: StageState;
  onOpenConversation: () => void;
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
  const active = outputs.find((output) => output.key === selected) ?? outputs[0];

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
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
    </div>
  );
}
