"use client";

import type { StageWidget as Widget } from "@/lib/stage/schema";
import type { StageRect } from "@/lib/stage/schema";

import dynamic from "next/dynamic";
import { Component, memo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Move } from "lucide-react";

import { StageChat } from "./stage-chat";

import { RecipeCard } from "@/components/chat/gen-ui/blocks/RecipeCard";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { stageCellStyle } from "@/lib/stage/frame";

const Diagram = dynamic(
  () => import("@/components/blog/mermaid-diagram").then((m) => m.MermaidDiagram),
  {
    ssr: false,
    loading: () => <p className="stage-muted">Opening diagram…</p>,
  }
);

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

// Geometry changes never re-run Markdown, recipe, or Mermaid rendering.
const PieceContent = memo(
  function PieceContent({ widget }: { widget: Widget }) {
    return (
      <PieceBoundary>
        {widget.kind === "note" && (
          <div className="stage-prose">
            <ChatMessageMarkdown content={widget.text} id={widget.id} wrapCodeBlocks />
          </div>
        )}
        {widget.kind === "mermaid" && (
          <Diagram
            code={widget.code}
            diagramId={widget.id}
            title={widget.title}
            variant="canvas"
            expandOnDoubleClick
          />
        )}
        {widget.kind === "recipe" && <RecipeCard block={widget.recipe} />}
        {widget.kind === "chat" && <StageChat threadId={widget.threadId} widgetId={widget.id} />}
      </PieceBoundary>
    );
  },
  (a, b) =>
    JSON.stringify({ ...a.widget, rect: undefined }) ===
    JSON.stringify({ ...b.widget, rect: undefined })
);

export const StageWidget = memo(function StageWidget({
  widget,
  selected,
  onSelect,
  rect = widget.rect,
}: {
  widget: Widget;
  selected: boolean;
  onSelect: (id: string) => void;
  rect?: StageRect;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.article
      aria-label={widget.title}
      className="stage-piece"
      data-kind={widget.kind}
      data-selected={selected}
      data-widget-id={widget.id}
      style={stageCellStyle(rect)}
      layout="position"
      transition={{ layout: { duration: reduced ? 0 : 0.14, ease: "easeOut" } }}
    >
      <div className="stage-piece-actions">
        <button
          aria-label={`Arrange ${widget.title}`}
          aria-pressed={selected}
          className="stage-icon-button"
          title="Arrange this piece"
          type="button"
          onClick={() => onSelect(widget.id)}
        >
          <Move size={14} />
        </button>
        {widget.kind === "chat" && (
          <a
            className="stage-icon-button"
            aria-label={`Open ${widget.title} as a full conversation`}
            href={`/chat/${widget.threadId}`}
          >
            <ArrowUpRight size={14} />
          </a>
        )}
      </div>
      {widget.kind === "chat" && <h2 className="stage-piece-title">{widget.title}</h2>}
      <div className="stage-piece-content">
        <PieceContent widget={widget} />
      </div>
    </motion.article>
  );
});
