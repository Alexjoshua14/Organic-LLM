"use client";

import type { StageWidget as Widget } from "@/lib/stage/schema";

import dynamic from "next/dynamic";
import { Component, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, MessageSquare, Move, Waypoints, FileText, CookingPot } from "lucide-react";

import { StageChat } from "./stage-chat";

import { RecipeCard } from "@/components/chat/gen-ui/blocks/RecipeCard";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";

const Diagram = dynamic(
  () => import("@/components/blog/mermaid-diagram").then((m) => m.MermaidDiagram),
  {
    ssr: false,
    loading: () => <p className="stage-muted">Opening diagram…</p>,
  }
);
const ICONS = { note: FileText, mermaid: Waypoints, recipe: CookingPot, chat: MessageSquare };
const LABELS = { note: "Note", mermaid: "Diagram", recipe: "Recipe", chat: "Conversation" };

class PieceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return <p role="alert">This piece couldn’t be displayed. Try reloading the stage.</p>;

    return this.props.children;
  }
}

export function StageWidget({
  widget,
  selected,
  onSelect,
}: {
  widget: Widget;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = ICONS[widget.kind];
  const { x, y, w, h } = widget.rect;
  const style: CSSProperties = {
    gridColumn: `${x + 1} / span ${w}`,
    gridRow: `${y + 1} / span ${h}`,
  };

  return (
    <article
      aria-label={widget.title}
      className="stage-piece"
      data-kind={widget.kind}
      data-selected={selected}
      data-widget-id={widget.id}
      style={style}
    >
      <header className="stage-piece-header">
        <span className="stage-piece-type">
          <Icon aria-hidden size={12} />
          {LABELS[widget.kind]}
        </span>
        <button
          aria-label={`Arrange ${widget.title}`}
          aria-pressed={selected}
          className="stage-icon-button"
          title="Arrange this piece"
          type="button"
          onClick={onSelect}
        >
          <Move size={14} />
        </button>
      </header>
      <h2 className="stage-piece-title">{widget.title}</h2>
      <div className="stage-piece-content">
        <PieceBoundary>
          {widget.kind === "note" && (
            <div className="stage-prose">
              <ChatMessageMarkdown content={widget.text} id={widget.id} wrapCodeBlocks />
            </div>
          )}
          {widget.kind === "mermaid" && (
            <Diagram code={widget.code} diagramId={widget.id} title={widget.title} />
          )}
          {widget.kind === "recipe" && <RecipeCard block={widget.recipe} />}
          {widget.kind === "chat" && <StageChat threadId={widget.threadId} widgetId={widget.id} />}
        </PieceBoundary>
      </div>
      <footer className="stage-piece-footer">
        <span>
          {String(x + 1).padStart(2, "0")}:{String(y + 1).padStart(2, "0")}
        </span>
        {widget.kind === "chat" ? (
          <a
            aria-label={`Open ${widget.title} as a full conversation`}
            href={`/chat/${widget.threadId}`}
          >
            <ArrowUpRight size={13} />
          </a>
        ) : (
          <span>
            {w} × {h}
          </span>
        )}
      </footer>
    </article>
  );
}
