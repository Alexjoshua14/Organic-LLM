import { cn } from "@/lib/utils";

/** Rest, hover spread, and a smaller held spread while the thread menu is open. */
export function ThreadMoreGlyph({ active = false }: { active?: boolean }) {
  return (
    <svg aria-hidden className="size-4" fill="currentColor" viewBox="0 0 24 24">
      <circle
        className={cn(
          "motion-safe:transition-transform motion-safe:duration-200",
          active ? "-translate-y-px" : "motion-safe:group-hover/thread-more:-translate-y-0.5"
        )}
        cx="12"
        cy="5"
        r="2"
      />
      <circle cx="12" cy="12" r="2" />
      <circle
        className={cn(
          "motion-safe:transition-transform motion-safe:duration-200",
          active ? "translate-y-px" : "motion-safe:group-hover/thread-more:translate-y-0.5"
        )}
        cx="12"
        cy="19"
        r="2"
      />
    </svg>
  );
}
