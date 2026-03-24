/**
 * Rabbit Hole design tokens — single source of truth for all typography,
 * spacing, surface, and layout values used across the explorer UI.
 *
 * Every component in app/rabbitholes/_components/ and components/rabbit-holes/
 * imports from here. To fine-tune the look, edit the values below.
 *
 * "compact" = mobile Safari layout. Default = desktop.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pick between compact (mobile) and desktop value. */
const pick = <T>(compact: boolean, c: T, d: T): T => (compact ? c : d);

// ─── Layout ───────────────────────────────────────────────────────────────────

export const layout = {
  /** Max-width of the article body wrapper */
  articleMaxWidth: { desktop: "max-w-2xl", compact: "max-w-none" },
  /** Max-width for the TTS audio block */
  ttsMaxWidth: "max-w-xl",
  /** Grid column width for left / right sidebars (raw CSS value) */
  sideColumnWidth: "260px",
  /** Full Tailwind grid-cols class (must be a static string for JIT) */
  gridCols: "lg:grid-cols-[260px_1fr_260px]",
  /** Focus-mode grid (single column) */
  gridColsFocus: "lg:grid-cols-[1fr]",
  /** Max-width for the overall 3-column grid */
  gridMaxWidth: "max-w-7xl",
};

// ─── Page title (h1) ──────────────────────────────────────────────────────────

export const title = {
  base: "font-commissioner font-light tracking-tight text-foreground",
  desktop: "mb-2 text-3xl",
  compact: "mb-2 text-[26px] leading-snug",
};

// ─── Page-level header ("Rabbit Hole Explorer") ──────────────────────────────

export const pageHeader = {
  text: "font-commissioner text-2xl font-light tracking-wide text-foreground",
  backLink: "text-muted-foreground hover:text-foreground transition-colors text-sm tracking-wide",
};

// ─── Spacing between hero sections (title → TTS → takeaways → article) ──────

export const heroSpacing = {
  titleBlock: "mb-2",
  ttsBlock: { desktop: "mb-5", compact: "mb-6" },
  takeawaysBlock: { desktop: "mb-8", compact: "mb-6" },
};

// ─── Section labels (uppercase: Key Takeaways, Sources, Explore Further …) ──

export const sectionLabel =
  "font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground font-light";

// ─── Card surface (glass background shared by all panels) ────────────────────

export const card = "bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm";

// ─── Article HTML content tokens (applied via [&_*] selectors) ───────────────

export const articleContent = {
  /** Root text color */
  base: "text-muted-foreground",

  leading: { desktop: "leading-[1.65]", compact: "leading-[1.55]" },

  /** Compact overflow guard */
  compactOverflow: "overflow-x-hidden",

  h2: {
    desktop:
      "[&_h2]:font-commissioner [&_h2]:text-2xl [&_h2]:font-light [&_h2]:mt-16 [&_h2]:mb-8 [&_h2]:text-foreground [&_h2]:tracking-tight",
    compact:
      "[&_h2]:font-commissioner [&_h2]:text-xl [&_h2]:font-light [&_h2]:mt-10 [&_h2]:mb-5 [&_h2]:text-foreground [&_h2]:tracking-tight",
  },

  h2Takeaway: {
    desktop: "[&_h2[id^='takeaway-']]:scroll-mt-20 [&_h2[id^='takeaway-']]:snap-start",
    compact: "[&_h2[id^='takeaway-']]:scroll-mt-14 [&_h2[id^='takeaway-']]:snap-start",
    shared: "[&_h2[id^='takeaway-']]:transition-colors",
  },

  h3: {
    desktop:
      "[&_h3]:font-commissioner [&_h3]:text-xl [&_h3]:font-light [&_h3]:mt-12 [&_h3]:mb-6 [&_h3]:text-foreground",
    compact:
      "[&_h3]:font-commissioner [&_h3]:text-lg [&_h3]:font-light [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:text-foreground",
  },

  p: {
    desktop: "[&_p]:mb-8 [&_p]:text-base [&_p]:leading-[1.5]",
    compact: "[&_p]:mb-6 [&_p]:text-base [&_p]:leading-[1.5]",
  },

  code: "[&_code]:break-words [&_code]:font-mono [&_code]:text-sm",
  pre: "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:font-mono [&_pre]:text-sm",
  img: "[&_img]:max-w-full [&_img]:h-auto",
  table: "[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto",
  strong: "[&_strong]:font-medium [&_strong]:text-foreground/85",
  em: "[&_em]:italic",

  branchLink: [
    "[&_span[data-branch-id]]:cursor-pointer",
    "[&_span[data-branch-id]]:underline",
    "[&_span[data-branch-id]]:underline-offset-2",
    "[&_span[data-branch-id]]:decoration-muted-foreground/30",
    "[&_span[data-branch-id]]:hover:decoration-muted-foreground",
    "[&_span[data-branch-id]]:hover:text-foreground",
    "[&_span[data-branch-id]]:transition-colors",
    "[&_span[data-branch-id]]:px-0.5",
    "[&_span[data-branch-id]]:rounded",
    "[&_span[data-branch-id]]:hover:bg-card/20",
  ] as const,

  /** Scroll-margin-top for JS-based offset (used in useEffect) */
  scrollMarginTop: { desktop: "80px", compact: "56px" },
};

// ─── Key Takeaways list items ────────────────────────────────────────────────

export const takeaway = {
  listGap: { desktop: "space-y-4", compact: "space-y-3" },
  padding: { desktop: "px-5 py-4", compact: "px-4 py-3" },
  innerPadding: { desktop: "px-5 pb-5", compact: "px-4 pb-4" },
  item: {
    base: "flex cursor-pointer items-start gap-4 font-satoshi",
    size: { desktop: "text-base", compact: "text-[15px]" },
  },
  bullet: "mt-1 shrink-0 transition-colors text-lg",
};

// ─── Source analysis view ────────────────────────────────────────────────────

export const sourceAnalysis = {
  sectionHeader: {
    base: "font-commissioner font-light text-foreground mb-4",
    desktop: "text-xl",
    compact: "text-lg",
  },
  bodyText: {
    base: "leading-relaxed text-muted-foreground",
    desktop: "text-base",
    compact: "text-[17px]",
  },
  keyPointItem: {
    base: "flex items-start gap-4 pl-2 text-muted-foreground",
    desktop: "text-base",
    compact: "text-[15px]",
  },
  keyPointListGap: { desktop: "space-y-6", compact: "space-y-4" },
  relevanceCard: { desktop: "p-6", compact: "p-4" },
};

// ─── Sidebar panels (sources, branches, path rail) ──────────────────────────

export const sidebar = {
  /** Source list item title */
  sourceTitle:
    "text-xs text-foreground group-hover:text-muted-foreground transition-colors line-clamp-1 flex-1 min-w-0",
  sourceFavicon: "w-4 h-4 shrink-0 opacity-70",

  /** Branch suggestion label + description */
  branchLabel: "font-satoshi text-sm font-medium text-foreground/85",
  branchDescription: "text-xs text-muted-foreground/70 leading-relaxed",

  /** Path rail item */
  pathLabel: { root: "text-sm", nested: "text-xs" },
  pathMeta: "text-xs text-muted-foreground/70 mt-1",

  /** New Rabbit Hole button */
  newButton: {
    icon: "text-lg text-muted-foreground",
    label: "text-sm font-medium text-muted-foreground",
  },
};

// ─── Loading / skeleton state ────────────────────────────────────────────────

export const loading = {
  message: "text-muted-foreground text-sm tracking-wide",
  previewLabel: sectionLabel,
  previewBody: "text-foreground text-base leading-relaxed",
  spinner: "w-8 h-8 text-muted-foreground",
};

// ─── Convenience: build article content className array ─────────────────────

export function articleContentClasses(compact: boolean): string[] {
  return [
    "article-content",
    articleContent.base,
    pick(compact, articleContent.leading.compact, articleContent.leading.desktop),
    ...(compact ? [articleContent.compactOverflow] : []),
    pick(compact, articleContent.h2.compact, articleContent.h2.desktop),
    pick(compact, articleContent.h2Takeaway.compact, articleContent.h2Takeaway.desktop),
    articleContent.h2Takeaway.shared,
    pick(compact, articleContent.h3.compact, articleContent.h3.desktop),
    pick(compact, articleContent.p.compact, articleContent.p.desktop),
    articleContent.code,
    articleContent.pre,
    articleContent.img,
    articleContent.table,
    articleContent.strong,
    articleContent.em,
    ...articleContent.branchLink,
  ];
}
