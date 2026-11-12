import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type DecisionNotesDisclosureProps = {
  block: DecisionMatrixBlock;
  /** Narrow to specific option ids; default includes every option. */
  optionIds?: string[];
  summary?: string;
};

/** Keeps every supplied option/cell note reachable when an arrangement hides them inline. */
export function DecisionNotesDisclosure({
  block,
  optionIds,
  summary = "All supplied notes",
}: DecisionNotesDisclosureProps) {
  const options = optionIds
    ? block.options.filter((option) => optionIds.includes(option.id))
    : block.options;

  const entries = options.flatMap((option) => {
    const rows: { key: string; label: string; body: string }[] = [];

    if (option.note) {
      rows.push({
        key: `${option.id}-option`,
        label: option.name,
        body: option.note,
      });
    }

    for (const criterion of block.criteria) {
      const note = block.scores[option.id]?.[criterion.id]?.note;

      if (note) {
        rows.push({
          key: `${option.id}-${criterion.id}`,
          label: `${option.name} · ${criterion.label}`,
          body: note,
        });
      }
    }

    return rows;
  });

  if (entries.length === 0) return null;

  return (
    <details className={styles.notesDisclosure}>
      <summary>{summary}</summary>
      <ul className={styles.notesDisclosureList}>
        {entries.map((entry) => (
          <li key={entry.key}>
            <strong>{entry.label}</strong>
            <div>
              <GenUIMarkdown inline>{entry.body}</GenUIMarkdown>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function DecisionSymbolLegend({ block }: { block: DecisionMatrixBlock }) {
  const hasSymbols = block.options.some((option) =>
    block.criteria.some((item) => {
      const value = block.scores[option.id]?.[item.id]?.value;

      return value != null && typeof value !== "number";
    })
  );
  const hasMissing = block.options.some((option) =>
    block.criteria.some((item) => !block.scores[option.id]?.[item.id])
  );

  return (
    <p className={styles.caption}>
      Supplied scores only — not a ranking
      {hasSymbols ? ". Symbols: ✓ = 5, ~ = 3, ✗ = 1 for any map; originals stay literal." : "."}
      {hasMissing ? " Gaps are unknown; no score is inferred." : ""}
      {block.recommendation
        ? ` Model recommendation (${
            block.options.find((o) => o.id === block.recommendation?.optionId)?.name ??
            block.recommendation.optionId
          }) is separate from any score pattern.`
        : ""}
    </p>
  );
}
