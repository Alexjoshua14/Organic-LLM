"use client";

import type { StageRect, StageWidget as Widget } from "@/lib/stage/schema";

import { useEffect, useState } from "react";

import { StageWidget } from "./stage-widget";

/** Visit lazily; tuck visited pieces away without losing their SVG, chat, or scroll state. */
export function StagePieces({
  widgets,
  visible,
  selectedId,
  onArrange,
}: {
  widgets: Widget[];
  visible: { widget: Widget; rect: StageRect }[];
  selectedId: string | null;
  onArrange: (id: string) => void;
}) {
  const [visited, setVisited] = useState<string[]>([]);

  useEffect(() => {
    setVisited((current) => {
      const next = [...new Set([...current, ...visible.map((p) => p.widget.id)])].filter((id) =>
        widgets.some((w) => w.id === id)
      );

      return next.length === current.length && next.every((id, i) => id === current[i])
        ? current
        : next;
    });
  }, [visible, widgets]);

  return widgets
    .filter((w) => visited.includes(w.id) || visible.some((p) => p.widget.id === w.id))
    .map((widget) => {
      const placement = visible.find((p) => p.widget.id === widget.id);

      return (
        <StageWidget
          key={widget.id}
          widget={placement?.widget ?? widget}
          hidden={!placement}
          selected={widget.id === selectedId}
          onSelect={onArrange}
        />
      );
    });
}
