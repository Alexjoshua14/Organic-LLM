"use client";

import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useEffect, useRef, useState } from "react";

import styles from "../blocks/DecisionMatrix.module.css";

type DecisionCriterionSelectorProps = {
  block: DecisionMatrixBlock;
  criterionId: string | undefined;
  evidenceId?: string;
  onSelect: (criterionId: string) => void;
};

type Edge = "none" | "start" | "middle" | "end";

/**
 * Criterion chips. Wide, they wrap. In a narrow card they become one scrolling line, since
 * criteria are 2 to 6 and their labels are the model's words, so no fixed grid fits them: each
 * chip keeps its natural width up to a cap (a long label ends in an ellipsis and carries its full
 * text as a tooltip; the evidence heading below always shows it whole). A fade at the clipped
 * edge says there is more, and the chosen chip is scrolled into view.
 */
export function DecisionCriterionSelector({
  block,
  criterionId,
  evidenceId,
  onSelect,
}: DecisionCriterionSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<Edge>("none");

  const measure = useCallback(() => {
    const row = ref.current;

    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;

    setEdge(
      max <= 1
        ? "none"
        : row.scrollLeft <= 1
          ? "start"
          : row.scrollLeft >= max - 1
            ? "end"
            : "middle"
    );
  }, []);

  useEffect(() => {
    const row = ref.current;

    measure();
    if (!row || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);

    observer.observe(row);

    return () => observer.disconnect();
  }, [measure, block.criteria]);

  // Bring the chosen chip into the visible part of the row. Scrolls the row only: scrollIntoView
  // would also move the page.
  useEffect(() => {
    const row = ref.current;
    const chosen = row?.querySelector<HTMLElement>('button[aria-pressed="true"]');

    if (!row || !chosen || row.scrollWidth <= row.clientWidth) return;
    const left = chosen.offsetLeft - (row.clientWidth - chosen.offsetWidth) / 2;

    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [criterionId]);

  return (
    <div
      ref={ref}
      aria-label="Inspect a criterion"
      className={styles.criteria}
      data-edge={edge}
      role="group"
      onScroll={measure}
    >
      {block.criteria.map((item, index) => (
        <button
          key={item.id}
          type="button"
          aria-controls={evidenceId}
          aria-pressed={item.id === criterionId}
          title={item.label}
          onClick={() => onSelect(item.id)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span className={styles.criterionLabel}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
