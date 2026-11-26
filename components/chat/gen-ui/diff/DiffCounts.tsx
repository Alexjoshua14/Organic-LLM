import { statBlocks } from "./diff-model";
import styles from "./Diff.module.css";

import { CompositionStroke } from "@/components/design-system/composition-bar";

/** Stat blocks drawn with the app's one bar stroke, in the diff's add / delete tones. */
const STAT_TONE: Record<ReturnType<typeof statBlocks>[number], string> = {
  add: "var(--color-accent)",
  del: "var(--color-destructive)",
  none: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
};

type DiffCountsProps = {
  added: number;
  removed: number;
};

/** "+12 −3" for the eye; the same numbers as a sentence for assistive tech. */
export function DiffCounts({ added, removed }: DiffCountsProps) {
  return (
    <span className={styles.counts}>
      <span aria-hidden className={styles.countAdd}>
        +{added}
      </span>
      <span aria-hidden className={styles.countDel}>
        −{removed}
      </span>
      <span className={styles.srOnly}>
        {added} {added === 1 ? "line" : "lines"} added, {removed} {removed === 1 ? "line" : "lines"}{" "}
        removed
      </span>
    </span>
  );
}

/** Five blocks proportioned by added vs removed. Decorative: the counts say it in text. */
export function DiffStatBar({ added, removed }: DiffCountsProps) {
  return (
    <span aria-hidden className={styles.bar}>
      {statBlocks(added, removed).map((tone, index) => (
        <span key={index} className={styles.barBlock} data-tone={tone}>
          <CompositionStroke
            className="w-full"
            color={STAT_TONE[tone]}
            glowColor={tone === "none" ? "transparent" : undefined}
          />
        </span>
      ))}
    </span>
  );
}
