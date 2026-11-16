import { cn } from "@/lib/utils";

/** Recessed well — diagram belongs to the message, not a floating card. */
export const mermaidWellClass = cn(
  "group/mermaid-well relative my-4 w-full min-w-0",
  "rounded-lg",
  "bg-background-tertiary/25 dark:bg-background-secondary/40",
  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
  "ring-1 ring-inset ring-border/35",
  "overflow-hidden"
);

/**
 * No `justify-center` on the scroller: centering a flex child that overflows clips its left
 * edge beyond reach. The svg centers itself with auto margins (see applyMermaidGlassStyles), which
 * fall back to the start edge when the diagram is wider than the well.
 */
export const mermaidWellInnerClass = cn(
  "relative flex min-h-[4.5rem] overflow-x-auto px-3 py-4",
  "[&_.mermaid]:my-0 [&_svg]:h-auto"
);

/** Staged reveal on first paint (opacity only — no layout animation). */
export const mermaidRevealClass = cn(
  "motion-safe:animate-[mermaid-reveal_0.42s_cubic-bezier(0.22,1,0.36,1)_both]",
  "motion-reduce:animate-none"
);

/** Hover-revealed control rail. */
export const mermaidControlsClass = cn(
  "pointer-events-none absolute right-2 top-2 z-10 flex gap-1",
  "opacity-0 transition-opacity duration-200",
  "group-hover/mermaid-well:opacity-100 group-focus-within/mermaid-well:opacity-100",
  // No hover on a touch screen: the controls stay put.
  "max-sm:opacity-100 pointer-coarse:opacity-100"
);

/** Room above the diagram for the always-visible phone controls, so they never sit on a node. */
export const mermaidControlsGutterClass = "max-sm:pt-12";

export const mermaidControlButtonClass = cn(
  "pointer-events-auto grid size-7 place-content-center rounded-md",
  "max-sm:size-10 pointer-coarse:size-11",
  "border border-border/50 bg-background/80 text-muted-foreground backdrop-blur-sm",
  "hover:bg-background hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
);

/** Resolve the active app font for Mermaid's `fontFamily` config. */
export function resolveMermaidFontFamily(): string {
  if (typeof document === "undefined") {
    return "var(--font-commissioner), sans-serif";
  }

  const body = document.body;
  const computed = getComputedStyle(body).fontFamily;

  if (computed && computed !== "inherit" && computed.trim().length > 0) {
    return computed;
  }

  return "var(--font-commissioner), sans-serif";
}

const MERMAID_GLASS_STYLE_ID = "mermaid-glass-style";

/**
 * Injected into rendered SVG so nodes, clusters, and labels use app tokens.
 * Includes `.cluster` / subgraph backgrounds (previously leaked Mermaid neutral white).
 */
export function buildMermaidGlassStyleMarkup(): string {
  return `
    [data-organic-mermaid] { color: var(--foreground, #20252b); font-family: inherit; font-size: 14px; }
    [data-organic-mermaid] :is(.node rect, .node polygon, .node circle, .node ellipse, .node .node-bkg, .node .label-container) {
      fill: color-mix(in srgb, var(--card, #ffffff) 92%, var(--foreground, #20252b) 8%) !important;
      stroke: color-mix(in srgb, var(--foreground, #20252b) 28%, transparent) !important;
      stroke-width: 1.2px !important;
    }
    [data-organic-mermaid] :is(.cluster rect, .cluster polygon) {
      fill: color-mix(in srgb, var(--card, #ffffff) 65%, var(--background, #f7f8fa) 35%) !important;
      stroke: var(--border, #c8cfd5) !important;
    }
    [data-organic-mermaid] :is(text, tspan, .label, .nodeLabel, .edgeLabel, .cluster-label, foreignObject p, foreignObject span) {
      color: var(--foreground, #20252b) !important;
      fill: var(--foreground, #20252b) !important;
      font-family: inherit !important;
      font-size: 14px !important;
      line-height: 1.45 !important;
    }
    [data-organic-mermaid] :is(.edgePath path, .edgePaths path, .flowchart-link, .node > line, line) {
      stroke: var(--muted-foreground, #687480) !important;
      stroke-width: 1.4px !important;
    }
    [data-organic-mermaid] marker path { fill: var(--muted-foreground, #687480) !important; stroke: var(--muted-foreground, #687480) !important; }
    [data-organic-mermaid] :is(.edgeLabel rect, .labelBkg) { fill: var(--card, #ffffff) !important; }
    [data-organic-mermaid] .edgeLabel { background: var(--card, #ffffff) !important; }
    [data-organic-mermaid] foreignObject > div { background: transparent !important; }
    [data-organic-mermaid] g.node[data-mermaid-highlighted="true"] :is(rect, polygon, circle, .node-bkg) { stroke: var(--foreground, #20252b) !important; stroke-width: 2px !important; }
    [data-organic-mermaid] g.node[data-mermaid-dimmed="true"] { opacity: 0.35; }
  `;
}

/**
 * An inline diagram shrinks to fit a narrow well, but never below this share of its natural size:
 * labels are 14px, and past about three quarters they stop being legible. Below it the well
 * scrolls sideways instead.
 */
export const MERMAID_MIN_FIT_SCALE = 0.75;

type GlassStyleOptions = {
  /** Shrink to the well's width, down to MERMAID_MIN_FIT_SCALE. Off where the diagram is panned. */
  fit?: boolean;
};

export function applyMermaidGlassStyles(
  svgEl: SVGSVGElement,
  { fit = false }: GlassStyleOptions = {}
): void {
  svgEl.querySelector(`#${MERMAID_GLASS_STYLE_ID}`)?.remove();

  svgEl.setAttribute("data-organic-mermaid", "");
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");

  styleEl.setAttribute("id", MERMAID_GLASS_STYLE_ID);
  styleEl.textContent = buildMermaidGlassStyleMarkup();
  svgEl.prepend(styleEl);
  // Mermaid can emit inline HTML label colors; put semantic ink above those declarations.
  svgEl
    .querySelectorAll<HTMLElement>(
      "foreignObject .nodeLabel, foreignObject .edgeLabel, foreignObject .label, foreignObject p, foreignObject span"
    )
    .forEach((label) =>
      label.style.setProperty("color", "var(--foreground, #20252b)", "important")
    );
  const viewBox = svgEl.viewBox?.baseVal;

  if (viewBox?.width > 0) {
    svgEl.style.display = "block";
    svgEl.style.marginInline = "auto";
    svgEl.style.height = "auto";
    svgEl.style.width = `${viewBox.width}px`;
    svgEl.style.maxWidth = fit ? "100%" : "none";
    svgEl.style.minWidth = fit ? `${Math.round(viewBox.width * MERMAID_MIN_FIT_SCALE)}px` : "";
  }
}
