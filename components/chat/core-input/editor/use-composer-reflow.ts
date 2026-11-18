"use client";

import type { Editor } from "@tiptap/core";
import type { RefObject } from "react";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { playReflow, snapshotReflow, wantsExpanded, type ReflowSnapshot } from "./composer-reflow";

/**
 * Drives the compact composer's one-line → stacked layout (docs/design/core-input-compact-reflow.md).
 *
 * The row is one line until the draft needs more room, then stacks; its `[data-reflow]` groups
 * glide between the two layouts. `forced` keeps it stacked (Markdown preview, a sending draft).
 * Returns whether the row is stacked; render it as `data-expanded` on the row.
 */
export function useComposerReflow(
  rowRef: RefObject<HTMLElement | null>,
  editor: Editor | null,
  { enabled, forced }: { enabled: boolean; forced: boolean }
) {
  const [expanded, setExpanded] = useState(forced);
  const expandedRef = useRef(forced);
  const reflowFrom = useRef<ReflowSnapshot | null>(null);
  const settled = useRef(false);
  const latest = useRef({ editor, enabled, forced });

  latest.current = { editor, enabled, forced };

  const evaluate = useCallback(() => {
    const row = rowRef.current;
    const { editor: target, enabled: on, forced: force } = latest.current;

    if (!row || !on) return;
    const want = force
      ? true
      : target && !target.isDestroyed
        ? wantsExpanded(target, row, false, expandedRef.current)
        : expandedRef.current;

    if (want === expandedRef.current) return;
    reflowFrom.current = settled.current ? snapshotReflow(row) : null;
    expandedRef.current = want;
    setExpanded(want);
  }, [rowRef]);

  useLayoutEffect(evaluate, [evaluate, editor, enabled, forced]);

  useEffect(() => {
    if (!editor || !enabled) return;
    editor.on("update", evaluate);
    const row = rowRef.current;
    const observer =
      row && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => evaluate()) : null;

    if (row) observer?.observe(row);
    // Measurements taken before the web font loads are for the wrong glyph widths.
    void document.fonts?.ready.then(evaluate);
    const frame = requestAnimationFrame(() => {
      settled.current = true;
    });

    return () => {
      editor.off("update", evaluate);
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [editor, enabled, evaluate, rowRef]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const from = reflowFrom.current;

    reflowFrom.current = null;
    if (row && from) playReflow(row, from, expanded);
  }, [expanded, rowRef]);

  return enabled ? expanded : false;
}
