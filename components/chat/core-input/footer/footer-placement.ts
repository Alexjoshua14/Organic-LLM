/**
 * Where each CoreInput footer control renders: on the toolbar, in the overflow menu, or not at
 * all. This is the one place that decides it. `CoreInputFooter` and `ComposerOverflowMenu` only
 * read the result, so moving a control into a menu starts with a change here.
 *
 * The function is pure on purpose: `tests/unit/core-input-footer-placement.test.ts` pins the
 * whole matrix, and its diff shows exactly what a placement change moved.
 */

export type FooterPlacement = "inline" | "menu" | "hidden";

/**
 * Every footer control, in toolbar order. The toolbar has three regions:
 *
 * - **leading** (left): persona, tool toggles, speech, preview, model + effort, context effort
 * - **trailing** (right of the tools row): add files, thread clipboard, mic, overflow menu
 * - **submit cluster** (far right, outside the measured tools row): steer, send
 */
export type FooterControlId =
  | "persona"
  | "toolToggles"
  | "speech"
  | "preview"
  | "modelEffort"
  | "contextEffort"
  | "addFiles"
  | "threadClipboard"
  | "mic"
  | "steer";

export type FooterPlacementMap = Record<FooterControlId, FooterPlacement>;

/** What the surface asked for (CoreInput props) plus the live layout. */
export type FooterSurface = {
  /**
   * Compact variant or a narrow shell (see `layout-breakpoints.ts`). The same flag CoreInput
   * puts on its controls context as `useCondensedLayout`.
   */
  condensed: boolean;
  /** `variant="compact"`: a single-line composer for side surfaces (Rabbit Holes, Introspection). */
  compact: boolean;
  /** The surface forwards the unified persona (main chat, Arcadia). */
  personaEnabled: boolean;
  /** The surface owns search, memory, and speech itself (e.g. Strata's Source tab). */
  hideWebMemorySpeechToggles: boolean;
  /** The surface passed `useSpeechFriendlyRef`, so it can act on a speech-friendly reply. */
  hasSpeechFriendly: boolean;
  /** The surface passed `enableMarkdownInputPreview` (Arcadia). */
  hasMarkdownPreview: boolean;
  /** The textarea is showing the rendered markdown preview instead of the editor. */
  previewingMarkdown: boolean;
  /** The surface passed `onSecondarySubmit` (Noesis steer). */
  hasSteer: boolean;
  /** Context effort is on for this surface (Arcadia + memory on + beta setting). */
  showContextEffort: boolean;
  /** Stage sends text and references only; other surfaces accept files. Defaults to true. */
  hasAttachments?: boolean;
};

/**
 * Today's placement rules. Comments marked **Quirk** describe behavior that is kept as-is but
 * may not be intended; each one is an open question on COA-412.
 */
export function resolveFooterPlacement(surface: FooterSurface): FooterPlacementMap {
  const {
    condensed,
    personaEnabled,
    hideWebMemorySpeechToggles,
    hasSpeechFriendly,
    hasMarkdownPreview,
    previewingMarkdown,
    hasSteer,
    showContextEffort,
    hasAttachments = true,
  } = surface;

  // The condensed layout keeps the tools a user reaches for on most turns on the toolbar and
  // moves the occasional ones (speech, preview, steer) into the overflow menu.
  const secondary = (available: boolean): FooterPlacement =>
    !available ? "hidden" : condensed ? "menu" : "inline";

  return {
    persona: personaEnabled ? "inline" : "hidden",

    // Compact layouts expose these same controls in the shared options panel.
    toolToggles: !hideWebMemorySpeechToggles ? "inline" : "hidden",

    // Read-aloud style is off the condensed layout for now (not used lately); the setting and
    // the desktop chip are unchanged.
    speech: hasSpeechFriendly && !condensed && !hideWebMemorySpeechToggles ? "inline" : "hidden",

    preview: secondary(hasMarkdownPreview),
    modelEffort: "inline",
    contextEffort: showContextEffort ? "inline" : "hidden",
    addFiles: hasAttachments ? "inline" : "hidden",
    threadClipboard: "inline",
    // Dictation writes into the textarea, which is swapped out while previewing markdown.
    mic: hasMarkdownPreview && previewingMarkdown ? "hidden" : "inline",
    steer: secondary(hasSteer),
  };
}

/** The overflow menu trigger renders only when at least one control was placed in it. */
export function hasOverflowItems(placement: FooterPlacementMap): boolean {
  return Object.values(placement).includes("menu");
}
