"use client";

import type { StageState } from "@/lib/stage/schema";

import { useState } from "react";
import { ArrowUpRight, Maximize2, Minimize2 } from "lucide-react";

import { StagePiecePicker } from "./stage-piece-picker";

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
  organicActive = true,
  onShowPieces,
  pieces,
  selectedPieceId,
  onSelectPiece,
}: {
  state: StageState;
  onOpenConversation: () => void;
  selectedAuthor?: string;
  onSelectAuthor?: (id: string) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  compact?: boolean;
  organicActive?: boolean;
  onShowPieces?: () => void;
  pieces?: StageState["widgets"];
  selectedPieceId?: string | null;
  onSelectPiece?: (id: string) => void;
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
  const recent = [...authors.values()].slice(-2);
  const pinned = authors.get(selectedAuthor ?? selected);

  if (pinned && !recent.includes(pinned)) recent[0] = pinned;
  const outputs = [
    {
      key: "organic",
      name: "Organic",
      message: organic ?? { id: "stage-home", role: "assistant" as const, text: "" },
    },
    ...recent.map((message) => ({ key: message.author!.id, name: message.author!.name, message })),
  ];

  if (selectedAuthor && !outputs.some((o) => o.key === selectedAuthor)) {
    const agent = state.subagents?.find((a) => a.id === selectedAuthor);
    const designer = state.design?.id === selectedAuthor ? state.design : null;
    const source = state.widgets.find((widget) => widget.source?.id === selectedAuthor)?.source;
    const name = agent?.name ?? (designer ? "Designer" : (source?.name ?? null));

    if (name)
      outputs.push({
        key: selectedAuthor,
        name,
        message: {
          id: selectedAuthor,
          role: "assistant",
          text: designer
            ? `Arranging the stage: ${designer.brief}`
            : agent?.status === "working" || agent?.status === "queued"
              ? `Working on: ${agent.goal}`
              : `${name}’s work is on the stage.`,
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
        <div className="stage-response-author-tabs">
          {outputs.map((output) => (
            <button
              key={output.key}
              type="button"
              aria-pressed={
                active.key === output.key && (output.key !== "organic" || organicActive)
              }
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
          {onShowPieces && (
            <button
              type="button"
              className="stage-response-author"
              aria-pressed={!organicActive && active.key === "organic"}
              onClick={onShowPieces}
            >
              Pieces
            </button>
          )}
          {!!pieces?.length && onSelectPiece && (
            <StagePiecePicker
              pieces={pieces}
              selectedId={selectedPieceId}
              onSelect={onSelectPiece}
            />
          )}
        </div>
        <div className="stage-response-actions">
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
