"use client";

import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import type { RefObject } from "react";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  createReflowMemo,
  playReflow,
  snapshotReflow,
  wantsExpanded,
  type ReflowSnapshot,
} from "./composer-reflow";

/**
 * Circuit breaker: more than this many layout changes inside `FLAP_WINDOW_MS` means the layouts
 * are disagreeing about the same draft. The composer then holds the stacked layout until the
 * draft changes, instead of flickering. `wantsExpanded` is built so this should never trip.
 */
export const REFLOW_FLAP_LIMIT = 4;
export const REFLOW_FLAP_WINDOW_MS = 1000;
/**
 * Returning to one line waits for typing to rest this long. Predictive text and autocorrect
 * replace a word by deleting then inserting; without the wait, a replacement at the wrap boundary
 * collapses and re-stacks within a frame or two. Stacking is never delayed.
 */
export const REFLOW_COLLAPSE_SETTLE_MS = 350;
/** Transaction meta the editor sets when its placeholder text changes, so the layout re-measures. */
export const PLACEHOLDER_CHANGED = "composerPlaceholderChanged";

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
  const memo = useRef(createReflowMemo());
  const flips = useRef<number[]>([]);
  const heldFor = useRef<string | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ editor, enabled, forced });

  latest.current = { editor, enabled, forced };

  const evaluate = useCallback(
    (settledInput = false) => {
      const row = rowRef.current;
      const { editor: target, enabled: on, forced: force } = latest.current;

      if (!row || !on) return;
      // Mid-composition (predictive text, IME) the DOM holds text the document doesn't have yet;
      // hold the layout and decide once the composition ends.
      if (target && !target.isDestroyed && target.view.composing) return;
      const draft = target && !target.isDestroyed ? target.state.doc.textContent : null;

      // Held stacked after a flap: stay until the draft actually changes.
      if (heldFor.current !== null) {
        if (draft === heldFor.current && !force) return;
        heldFor.current = null;
        flips.current = [];
      }
      const want = force
        ? true
        : target && !target.isDestroyed
          ? wantsExpanded(target, row, false, expandedRef.current, memo.current)
          : expandedRef.current;

      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
      if (want === expandedRef.current) return;
      // Back to one line only once typing rests (see REFLOW_COLLAPSE_SETTLE_MS).
      if (!want && !settledInput) {
        collapseTimer.current = setTimeout(() => {
          collapseTimer.current = null;
          evaluate(true);
        }, REFLOW_COLLAPSE_SETTLE_MS);

        return;
      }
      const now = performance.now();

      flips.current = [...flips.current.filter((t) => now - t < REFLOW_FLAP_WINDOW_MS), now];
      if (flips.current.length > REFLOW_FLAP_LIMIT) {
        heldFor.current = draft;
        if (expandedRef.current) return;
      }
      reflowFrom.current = settled.current ? snapshotReflow(row) : null;
      expandedRef.current = want;
      setExpanded(want);
    },
    [rowRef]
  );

  useLayoutEffect(() => evaluate(), [evaluate, editor, enabled, forced]);

  useEffect(() => {
    if (!editor || !enabled) return;
    const onUpdate = () => evaluate();
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.getMeta(PLACEHOLDER_CHANGED)) requestAnimationFrame(() => evaluate());
    };
    const onCompositionEnd = () => requestAnimationFrame(() => evaluate());
    const dom = editor.view.dom;

    editor.on("update", onUpdate);
    editor.on("transaction", onTransaction);
    dom.addEventListener("compositionend", onCompositionEnd);
    const row = rowRef.current;
    const observer =
      row && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => evaluate()) : null;

    if (row) observer?.observe(row);
    // Measurements taken before the web font loads are for the wrong glyph widths.
    void document.fonts?.ready.then(() => evaluate());
    const frame = requestAnimationFrame(() => {
      settled.current = true;
    });

    return () => {
      editor.off("update", onUpdate);
      editor.off("transaction", onTransaction);
      dom.removeEventListener("compositionend", onCompositionEnd);
      observer?.disconnect();
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
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
