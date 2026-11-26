import { secondaryInteractive } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

/**
 * Keyboard focus for Gen UI controls: a surface/text swap per docs/design/focus-feedback.md,
 * never a ring. One definition, so every block focuses the same way.
 */
export const GEN_UI_FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

/**
 * A block's action (Apply, Rerun, Submit, Commit full render): the shared Lumen-backed
 * `secondaryInteractive` control, not a solid accent fill, so actions look the same in every
 * block and match the rest of the app. `md` keeps the 44px touch target; `sm` is for condensed
 * rows where the action sits beside a status line.
 */
export function genUiActionClass(size: "sm" | "md" = "md") {
  return cn(
    secondaryInteractive(),
    "rounded-lg font-medium disabled:opacity-40",
    size === "md" ? "min-h-11 px-inset-md text-sm" : "px-inset-sm py-1.5 text-xs"
  );
}
