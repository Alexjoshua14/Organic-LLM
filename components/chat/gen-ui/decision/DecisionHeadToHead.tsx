import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import { useId, useState } from "react";

import styles from "../blocks/DecisionMatrix.module.css";

import { optionStyle } from "./option-style";
import { DecisionNotesDisclosure } from "./DecisionNotesDisclosure";

import { formatMatrixScoreValue } from "@/lib/schemas/gen-ui";
import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";

type DecisionHeadToHeadProps = {
  block: DecisionMatrixBlock;
  partial?: boolean;
};

function pickDefaultPair(block: DecisionMatrixBlock): [string, string] {
  const first = block.options[0]?.id ?? "";
  const recommended = block.recommendation?.optionId;
  const second =
    recommended && recommended !== first ? recommended : (block.options[1]?.id ?? first);

  return [first, second];
}

export function DecisionHeadToHead({ block, partial }: DecisionHeadToHeadProps) {
  const selectId = useId();
  const [defaults] = useState(() => pickDefaultPair(block));
  const [leftId, setLeftId] = useState(defaults[0]);
  const [rightId, setRightId] = useState(defaults[1]);

  const left = block.options.find((option) => option.id === leftId) ?? block.options[0];
  const right =
    block.options.find((option) => option.id === rightId) ?? block.options[1] ?? block.options[0];

  if (!left || !right) return null;

  const leftIndex = block.options.findIndex((option) => option.id === left.id);
  const rightIndex = block.options.findIndex((option) => option.id === right.id);
  const comparedIds = [left.id, right.id];
  const otherIds = block.options
    .map((option) => option.id)
    .filter((id) => !comparedIds.includes(id));

  return (
    <div className={styles.headToHead}>
      <div className={styles.headToHeadPickers}>
        <label className={styles.selectField} htmlFor={`${selectId}-left`}>
          <span>Option A</span>
          <select
            id={`${selectId}-left`}
            value={left.id}
            onChange={(event) => setLeftId(event.target.value)}
          >
            {block.options.map((option) => (
              <option key={option.id} value={option.id} disabled={option.id === right.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectField} htmlFor={`${selectId}-right`}>
          <span>Option B</span>
          <select
            id={`${selectId}-right`}
            value={right.id}
            onChange={(event) => setRightId(event.target.value)}
          >
            {block.options.map((option) => (
              <option key={option.id} value={option.id} disabled={option.id === left.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.headToHeadMeta} role="group" aria-label="Compared options">
        <div style={optionStyle(Math.max(0, leftIndex))}>
          <span className={styles.swatch} aria-hidden="true">
            {leftIndex + 1}
          </span>
          <div>
            <strong>{left.name}</strong>
            {left.note ? (
              <div className={styles.optionNote}>
                <GenUIMarkdown inline>{left.note}</GenUIMarkdown>
              </div>
            ) : null}
          </div>
        </div>
        <div style={optionStyle(Math.max(0, rightIndex))}>
          <span className={styles.swatch} aria-hidden="true">
            {rightIndex + 1}
          </span>
          <div>
            <strong>{right.name}</strong>
            {right.note ? (
              <div className={styles.optionNote}>
                <GenUIMarkdown inline>{right.note}</GenUIMarkdown>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ul className={styles.headToHeadList}>
        {block.criteria.map((criterion) => {
          const leftCell = block.scores[left.id]?.[criterion.id];
          const rightCell = block.scores[right.id]?.[criterion.id];

          return (
            <li key={criterion.id}>
              <div className={styles.headToHeadCriterion}>
                <h4>{criterion.label}</h4>
                {criterion.weight != null ? (
                  <p className={styles.meta}>Weight {criterion.weight}/5</p>
                ) : null}
              </div>
              <div className={styles.headToHeadScores}>
                <div style={optionStyle(Math.max(0, leftIndex))}>
                  <p
                    className={styles.score}
                    aria-label={`${left.name}, ${criterion.label}: ${leftCell ? formatMatrixScoreValue(leftCell.value) : "unknown"}`}
                  >
                    {leftCell ? formatMatrixScoreValue(leftCell.value) : "—"}
                    {leftCell && typeof leftCell.value === "number" ? <small>/5</small> : null}
                  </p>
                  <div className={styles.note}>
                    {leftCell?.note ? (
                      <GenUIMarkdown inline>{leftCell.note}</GenUIMarkdown>
                    ) : leftCell ? (
                      "No supporting note supplied."
                    ) : partial ? (
                      "Awaiting score…"
                    ) : (
                      "Score not supplied."
                    )}
                  </div>
                </div>
                <div style={optionStyle(Math.max(0, rightIndex))}>
                  <p
                    className={styles.score}
                    aria-label={`${right.name}, ${criterion.label}: ${rightCell ? formatMatrixScoreValue(rightCell.value) : "unknown"}`}
                  >
                    {rightCell ? formatMatrixScoreValue(rightCell.value) : "—"}
                    {rightCell && typeof rightCell.value === "number" ? <small>/5</small> : null}
                  </p>
                  <div className={styles.note}>
                    {rightCell?.note ? (
                      <GenUIMarkdown inline>{rightCell.note}</GenUIMarkdown>
                    ) : rightCell ? (
                      "No supporting note supplied."
                    ) : partial ? (
                      "Awaiting score…"
                    ) : (
                      "Score not supplied."
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className={styles.caption}>
        Head-to-head shows two options across every criterion — not a ranking.
        {block.recommendation
          ? " Aion’s recommendation stays in the header, separate from this pair."
          : ""}
      </p>

      {otherIds.length > 0 ? (
        <DecisionNotesDisclosure
          block={block}
          optionIds={otherIds}
          summary="Notes for options not in this pair"
        />
      ) : null}
    </div>
  );
}
