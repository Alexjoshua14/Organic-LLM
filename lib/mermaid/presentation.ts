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

export const mermaidWellInnerClass = cn(
  "relative flex min-h-[4.5rem] justify-center overflow-x-auto px-3 py-4",
  "[&_.mermaid]:my-0 [&_svg]:h-auto [&_svg]:max-w-none"
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
  "group-hover/mermaid-well:opacity-100 group-focus-within/mermaid-well:opacity-100"
);

export const mermaidControlButtonClass = cn(
  "pointer-events-auto grid size-7 place-content-center rounded-md",
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
    .mermaid svg .cluster rect,
    .mermaid svg .cluster polygon {
      fill: color-mix(in srgb, var(--card) 72%, var(--background) 28%) !important;
      stroke: var(--border) !important;
      stroke-width: 1 !important;
    }

    .mermaid svg .cluster .cluster-label text,
    .mermaid svg .cluster-label text {
      fill: var(--muted-foreground) !important;
      font-weight: 500 !important;
    }

    .mermaid svg .node rect,
    .mermaid svg .node polygon,
    .mermaid svg .node circle,
    .mermaid svg .node ellipse,
    .mermaid svg .node path,
    .mermaid svg .node .node-bkg,
    .mermaid svg .node .basic.label-container {
      fill: var(--card) !important;
      stroke: var(--border) !important;
      stroke-width: 1 !important;
    }

    .mermaid svg .edgePath path,
    .mermaid svg .edgePaths path {
      stroke: var(--muted-foreground) !important;
    }

    .mermaid svg .node > line {
      stroke: var(--muted-foreground) !important;
    }

    .mermaid svg .node.mindmap-node .node-bkg,
    .mermaid svg .node.mindmap-node .basic.label-container {
      paint-order: stroke fill;
      fill: var(--card) !important;
      stroke: var(--card) !important;
      stroke-width: 5 !important;
    }

    .mermaid svg foreignObject > div {
      background-color: var(--card) !important;
    }

    .mermaid svg .label text,
    .mermaid svg .node text,
    .mermaid svg text,
    .mermaid svg tspan {
      fill: var(--foreground) !important;
    }

    .mermaid svg foreignObject .nodeLabel,
    .mermaid svg foreignObject .nodeLabel p,
    .mermaid svg foreignObject .markdown-node-label,
    .mermaid svg foreignObject .markdown-node-label p {
      color: var(--foreground) !important;
    }

    .mermaid svg line {
      stroke: var(--muted-foreground) !important;
    }

    .dark .mermaid svg .cluster rect,
    .dark .mermaid svg .cluster polygon {
      fill: color-mix(in srgb, var(--card) 55%, var(--background) 45%) !important;
      stroke: rgba(255, 255, 255, 0.14) !important;
    }

    .dark .mermaid svg .node rect,
    .dark .mermaid svg .node polygon,
    .dark .mermaid svg .node circle,
    .dark .mermaid svg .node ellipse,
    .dark .mermaid svg .node path,
    .dark .mermaid svg .node .node-bkg,
    .dark .mermaid svg .node .basic.label-container {
      fill: color-mix(in srgb, var(--card) 92%, var(--foreground) 8%) !important;
      stroke: rgba(255, 255, 255, 0.18) !important;
      stroke-width: 1 !important;
    }

    .dark .mermaid svg .edgePath path,
    .dark .mermaid svg .edgePaths path {
      stroke: rgba(255, 255, 255, 0.35) !important;
    }

    .dark .mermaid svg .node > line {
      stroke: rgba(255, 255, 255, 0.35) !important;
    }

    .dark .mermaid svg .node.mindmap-node .node-bkg,
    .dark .mermaid svg .node.mindmap-node .basic.label-container {
      paint-order: stroke fill;
      fill: color-mix(in srgb, var(--card) 92%, var(--foreground) 8%) !important;
      stroke: color-mix(in srgb, var(--card) 92%, var(--foreground) 8%) !important;
      stroke-width: 5 !important;
    }

    .dark .mermaid svg foreignObject > div {
      background-color: color-mix(in srgb, var(--card) 92%, var(--foreground) 8%) !important;
    }

    .dark .mermaid svg .label text,
    .dark .mermaid svg .node text,
    .dark .mermaid svg text,
    .dark .mermaid svg tspan {
      fill: rgba(255, 255, 255, 0.9) !important;
    }

    .dark .mermaid svg foreignObject .nodeLabel,
    .dark .mermaid svg foreignObject .nodeLabel p,
    .dark .mermaid svg foreignObject .markdown-node-label,
    .dark .mermaid svg foreignObject .markdown-node-label p {
      color: rgba(255, 255, 255, 0.9) !important;
    }

    .dark .mermaid svg line {
      stroke: rgba(255, 255, 255, 0.35) !important;
    }

    .mermaid svg g.node[data-mermaid-highlighted="true"] rect,
    .mermaid svg g.node[data-mermaid-highlighted="true"] polygon,
    .mermaid svg g.node[data-mermaid-highlighted="true"] circle,
    .mermaid svg g.node[data-mermaid-highlighted="true"] .node-bkg {
      stroke: rgb(var(--lumen-rim) / 0.85) !important;
      stroke-width: 2 !important;
    }

    .mermaid svg g.node[data-mermaid-dimmed="true"] {
      opacity: 0.35;
    }
  `;
}

export function applyMermaidGlassStyles(svgEl: SVGSVGElement): void {
  svgEl.querySelector(`#${MERMAID_GLASS_STYLE_ID}`)?.remove();

  const styleEl = document.createElement("style");

  styleEl.setAttribute("id", MERMAID_GLASS_STYLE_ID);
  styleEl.textContent = buildMermaidGlassStyleMarkup();
  svgEl.prepend(styleEl);
}
