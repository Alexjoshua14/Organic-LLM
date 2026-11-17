import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import styles from "../blocks/DecisionMatrix.module.css";

import { optionStyle } from "./option-style";

import { formatMatrixScoreValue } from "@/lib/schemas/gen-ui";
import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type DecisionEvidenceListProps = {
  block: DecisionMatrixBlock;
  criterion: DecisionMatrixBlock["criteria"][number];
  id: string;
  partial?: boolean;
  /** Enlarge notes relative to scores (evidence-led arrangement). */
  notesProminent?: boolean;
};

export function DecisionEvidenceList({
  block,
  criterion,
  id,
  partial,
  notesProminent,
}: DecisionEvidenceListProps) {
  return (
    <section
      id={id}
      className={notesProminent ? styles.evidenceProminent : styles.evidence}
      aria-label={`${criterion.label} evidence`}
    >
      <div className={styles.evidenceHeading}>
        <h4>{criterion.label}</h4>
        {criterion.weight != null ? (
          <p>
            Weight <strong>{criterion.weight}/5</strong>
          </p>
        ) : null}
      </div>
      <ul className={notesProminent ? styles.evidenceListNotes : styles.evidenceList}>
        {block.options.map((option, index) => {
          const cell = block.scores[option.id]?.[criterion.id];

          return (
            <li key={option.id} style={optionStyle(index)}>
              <div className={styles.optionName}>
                <span className={styles.swatch} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <strong>{option.name}</strong>
                  {option.note ? (
                    <div className={styles.optionNote}>
                      <GenUIMarkdown inline>{option.note}</GenUIMarkdown>
                    </div>
                  ) : null}
                </div>
              </div>
              <p
                className={styles.score}
                aria-label={`${option.name} score: ${cell ? formatMatrixScoreValue(cell.value) : "unknown"}`}
              >
                {cell ? formatMatrixScoreValue(cell.value) : "—"}
                {cell && typeof cell.value === "number" ? <small>/5</small> : null}
              </p>
              <div className={notesProminent ? styles.noteProminent : styles.note}>
                {cell?.note ? (
                  <GenUIMarkdown inline>{cell.note}</GenUIMarkdown>
                ) : cell ? (
                  "No supporting note supplied."
                ) : partial ? (
                  "Awaiting score…"
                ) : (
                  "Score not supplied."
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
