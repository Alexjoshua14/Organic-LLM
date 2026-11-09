import type { PlanDependency, PlanStepView } from "./plan-model";

import { PlanStatusWord } from "./plan-status";
import styles from "./Plan.module.css";

type PlanLinksProps = {
  label: string;
  labelId: string;
  steps: readonly PlanStepView[];
  /** Declared dependencies (may dangle) or plain step indices (dependants). */
  items: readonly (PlanDependency | number)[];
  onSelect: (index: number) => void;
};

function StepLink({
  view,
  onSelect,
  note,
}: {
  view: PlanStepView;
  onSelect: (index: number) => void;
  note?: string;
}) {
  return (
    <li>
      <button className={styles.link} type="button" onClick={() => onSelect(view.index)}>
        <span className={styles.linkNumber}>
          <span className={styles.srOnly}>Step </span>
          {view.number}
        </span>
        <span className={styles.linkLabel}>{view.step.label}</span>
        <PlanStatusWord status={view.step.status} />
        {note ? <span className={styles.linkNote}>{note}</span> : null}
      </button>
    </li>
  );
}

/**
 * One relationship line — "Depends on  02 Sandbox gallery Now" — as navigable text. A dependency
 * that points nowhere (or at itself) is stated as such instead of rendering a dead link.
 */
export function PlanLinks({ label, labelId, steps, items, onSelect }: PlanLinksProps) {
  if (items.length === 0) return null;

  return (
    <div className={styles.relation}>
      <p className={styles.relationLabel} id={labelId}>
        {label}
      </p>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul aria-labelledby={labelId} className={styles.links} role="list">
        {items.map((item) => {
          if (typeof item === "number") {
            const view = steps[item];

            return view ? <StepLink key={view.key} view={view} onSelect={onSelect} /> : null;
          }

          if (item.kind === "step") {
            const view = steps[item.index];

            return view ? (
              <StepLink
                key={`${item.id}:${item.index}`}
                note={item.matches > 1 ? `id shared by ${item.matches} steps` : undefined}
                view={view}
                onSelect={onSelect}
              />
            ) : null;
          }

          return (
            <li key={`${item.kind}:${item.id}`} className={styles.dangling}>
              <code>{item.id}</code>{" "}
              <span>
                {item.kind === "self" ? "depends on itself" : "is not a step in this plan"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
