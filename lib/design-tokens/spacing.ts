/**
 * Global spacing tokens — semantic Tailwind class aliases.
 *
 * Primitives live in `styles/globals.css` (`@theme` `--spacing-*`).
 * Prefer these semantic names over raw `space-y-4` in product UI.
 *
 * @see docs/design/spacing.md
 */

export const spacing = {
  stack: {
    xs: "space-y-stack-xs",
    sm: "space-y-stack-sm",
    md: "space-y-stack-md",
    lg: "space-y-stack-lg",
    xl: "space-y-stack-xl",
    "2xl": "space-y-stack-2xl",
    "3xl": "space-y-stack-3xl",
  },
  gap: {
    sm: "gap-inline-sm",
    md: "gap-inline-md",
    lg: "gap-inline-lg",
  },
  /** Gen-ui cards and similar dense blocks */
  card: {
    /** Major sections (summary, actions, hours, menu) — tighter on desktop */
    section: "space-y-stack-lg sm:space-y-stack-md",
    /** Back link + expanded body chrome */
    chrome: "space-y-stack-md",
    /** Labeled subsection (header row → expandable body, e.g. hours week list) */
    block: "space-y-stack-md",
    /** Section label → primary content (Hours → today, Menu → categories) */
    labelStack: "space-y-stack-xs",
    /** Rows inside a subsection (menu categories, week list) */
    blockItems: "space-y-stack-sm",
    /** Tight list rows (hours day lines, menu items) */
    listItems: "space-y-stack-xs",
    /** Extra lead before review-source pills (stacks on section gap) */
    sourcesLead: "mt-stack-xs",
  },
} as const;
