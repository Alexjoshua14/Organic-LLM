"use client";

import { Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from "@heroui/modal";
import mermaid from "mermaid";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import { ensureMermaidDomPurify, sanitizeMermaidSvgMarkup } from "@/lib/html/sanitize";
import { normalizeMermaidCode } from "@/lib/mermaid/source";

let mermaidInitialized = false;

/**
 * Mermaid's config is global. Initialize exactly once, and only from an effect:
 * theme setup runs khroma over the neutral palette, which throws outside a
 * browser, so this must never execute during SSR of this client component.
 *
 * `suppressErrorRendering` stops Mermaid from drawing its "syntax error"
 * graphic into the scratch element it appends to <body> and then leaving it
 * attached — this component renders its own error state.
 */
function initializeMermaidOnce() {
  if (mermaidInitialized) return;
  mermaidInitialized = true;

  ensureMermaidDomPurify();
  // Strict mode strips HTML in foreignObject; DOMPurify is provided via ensureMermaidDomPurify.
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "strict",
    suppressErrorRendering: true,
  });
}

/**
 * Mermaid is a singleton: `render()` keys its scratch DOM off the id alone, and
 * several diagram types parse into module-level databases. Concurrent renders
 * delete each other's working elements mid-flight, which surfaces as "Cannot
 * read properties of null" or an empty SVG on pages with more than one diagram.
 * Serialize every render through one chain.
 */
let mermaidRenderQueue: Promise<unknown> = Promise.resolve();

function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const result = mermaidRenderQueue.then(task, task);

  mermaidRenderQueue = result.catch(() => {});

  return result;
}

/** Returned instead of an SVG when a queued render was superseded while waiting. */
const STALE_RENDER = Symbol("stale-mermaid-render");

type MermaidRenderOutcome = Awaited<ReturnType<typeof mermaid.render>> | typeof STALE_RENDER;

/**
 * Streamed markdown delivers a diagram a few characters at a time, so most
 * parse failures are just a half-written node that the next chunk completes.
 * Wait this long after the last failure before surfacing an error — a new
 * `code` value cancels the pending report.
 */
const ERROR_GRACE_MS = 400;

export function MermaidDiagram({
  code,
  expandOnDoubleClick = false,
}: {
  code: string;
  /** When true (e.g. Arcadia chat), double-click opens a larger modal view. */
  expandOnDoubleClick?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderEpochRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  // Mermaid interpolates the render id straight into a CSS selector, so strip
  // anything React's useId format may include (":" in 18, "«»" in 19).
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const handleExpandedKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
    [onOpen]
  );

  function toRenderErrorMessage(err: unknown): string {
    if (err instanceof Error && typeof err.message === "string" && err.message.trim()) {
      return err.message;
    }
    if (typeof err === "string" && err.trim()) {
      return err;
    }
    if (err == null) {
      return "Unknown Mermaid render error";
    }
    try {
      const asJson = JSON.stringify(err);

      return asJson && asJson !== "{}" ? asJson : String(err);
    } catch {
      return String(err);
    }
  }

  const applyMindmapLayering = (svgEl: SVGSVGElement) => {
    const root = svgEl.querySelector(":scope > g");
    const edgePaths = svgEl.querySelector(".edgePaths");
    const edgeLabels = svgEl.querySelector(".edgeLabels");
    const nodes = svgEl.querySelector(".nodes");

    if (edgePaths) {
      // Hoist per-node connector lines into the shared edge layer, preserving each
      // node's translate() so coordinates stay correct after reparenting.
      svgEl.querySelectorAll("g.node.mindmap-node").forEach((node) => {
        const line = node.querySelector(":scope > line");

        if (!line) return;

        const transform = node.getAttribute("transform");
        const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");

        wrapper.setAttribute("class", "mindmap-connector");
        if (transform) wrapper.setAttribute("transform", transform);
        wrapper.appendChild(line);
        edgePaths.appendChild(wrapper);
      });
    }

    // `insertBefore` throws NotFoundError ("The object can not be found here."
    // in WebKit) when `nodes` is not a direct child of `root` — some diagram
    // types (e.g. state) nest it deeper. Only reorder when they are siblings.
    if (root && nodes && nodes.parentNode === root) {
      if (edgePaths) root.insertBefore(edgePaths, nodes);
      if (edgeLabels) root.insertBefore(edgeLabels, nodes);
    }
  };

  const applyGlassStylingToSvg = (svgEl: SVGSVGElement) => {
    const styleId = "mermaid-glass-style";

    // Remove any prior injected style so re-renders don't accumulate.
    svgEl.querySelector(`#${styleId}`)?.remove();

    const styleEl = document.createElement("style");

    styleEl.setAttribute("id", styleId);
    styleEl.textContent = `
      /* Light mode (no .dark on html): opaque card fills so edges do not bleed through */
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

      /* Mindmap nodes: opaque halo masks connector strokes at pill/circle edges */
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

      /* Mindmaps render labels as HTML inside foreignObject; Mermaid alternates
         section colors (light text on dark nodes) which breaks once fills are
         normalized to card surfaces above. */
      .mermaid svg foreignObject .nodeLabel,
      .mermaid svg foreignObject .nodeLabel p,
      .mermaid svg foreignObject .markdown-node-label,
      .mermaid svg foreignObject .markdown-node-label p {
        color: var(--foreground) !important;
      }

      .mermaid svg line {
        stroke: var(--muted-foreground) !important;
      }

      /* Dark mode: raised-opacity fills so connectors stay underneath readable nodes */
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
    `;

    svgEl.prepend(styleEl);
    applyMindmapLayering(svgEl);
  };

  useEffect(() => {
    if (!code) return;
    const epoch = ++renderEpochRef.current;
    // Diagrams from `make_mermaid_diagram` are already normalized server-side,
    // but ```mermaid fences in a normal assistant reply are not.
    const safeCode = normalizeMermaidCode(code);

    let cancelled = false;

    const isCurrent = () => !cancelled && renderEpochRef.current === epoch;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const renderOnce = async (diagramCode: string) => {
      initializeMermaidOnce();

      if (!isCurrent()) return;

      // `render()` parses too, so a separate `mermaid.parse()` would only
      // double the work and the window for cross-diagram interference.
      const renderId = `mermaid-${instanceId}-${epoch}`;
      // Queue only the Mermaid call — that is the part touching shared globals.
      const renderResult = await enqueueMermaidRender<MermaidRenderOutcome>(() =>
        isCurrent() ? mermaid.render(renderId, diagramCode) : Promise.resolve(STALE_RENDER)
      );

      if (renderResult === STALE_RENDER) return;

      const svgMarkup =
        typeof renderResult === "string" ? renderResult : (renderResult as { svg?: string })?.svg;

      if (!svgMarkup) {
        throw new Error("Mermaid render returned empty SVG.");
      }

      const safeSvgMarkup = sanitizeMermaidSvgMarkup(svgMarkup);

      if (!isCurrent() || !containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = safeSvgMarkup;
      const svg = containerRef.current.querySelector("svg");

      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Diagram");
        // Styling/layering is cosmetic and best-effort: never let a DOM quirk
        // here blank an already-rendered diagram.
        try {
          applyGlassStylingToSvg(svg as SVGSVGElement);
        } catch {
          /* keep the rendered SVG even if glass styling fails */
        }
      }
    };

    const run = async () => {
      try {
        await renderOnce(safeCode);
        if (isCurrent()) setError(null);
      } catch (firstErr) {
        // Mermaid loads each diagram type from its own lazy chunk, so a first
        // render can still lose to a slow import; retry once on the next tick.
        await wait(30);
        if (!isCurrent()) return;
        try {
          await renderOnce(safeCode);
          if (isCurrent()) setError(null);
        } catch (retryErr) {
          const bestError = toRenderErrorMessage(retryErr) || toRenderErrorMessage(firstErr);

          await wait(ERROR_GRACE_MS);
          if (!isCurrent()) return;

          // Only drop the previously rendered diagram once the failure is real.
          if (containerRef.current) containerRef.current.innerHTML = "";
          setError(bestError);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [code]);

  // The container stays mounted even while erroring: the render effect bails out
  // when the ref is empty, so unmounting it would strand the error state and
  // ignore every later `code` update (e.g. the rest of a streamed diagram).
  const diagram = (
    <>
      {error ? (
        <div
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Diagram could not be rendered: {error}
        </div>
      ) : null}
      <div
        ref={containerRef}
        aria-label={
          expandOnDoubleClick ? "Diagram — double-click or press Enter to enlarge" : undefined
        }
        className={cn(
          "mermaid my-4 flex justify-center overflow-x-auto [&_svg]:max-w-full",
          expandOnDoubleClick &&
            "cursor-zoom-in select-none rounded-md outline-none ring-offset-2 transition-shadow hover:ring-2 hover:ring-border/60 focus-visible:ring-2 focus-visible:ring-ring",
          error && "hidden"
        )}
        role={expandOnDoubleClick ? "button" : undefined}
        tabIndex={expandOnDoubleClick ? 0 : undefined}
        onDoubleClick={expandOnDoubleClick ? onOpen : undefined}
        onKeyDown={expandOnDoubleClick ? handleExpandedKeyDown : undefined}
      />
    </>
  );

  if (!expandOnDoubleClick) {
    return diagram;
  }

  return (
    <>
      {diagram}
      <Modal isOpen={isOpen} scrollBehavior="inside" size="5xl" onOpenChange={onOpenChange}>
        <ModalContent className="max-h-[92dvh]">
          <ModalHeader className="flex flex-col gap-1 pb-1">Diagram</ModalHeader>
          <ModalBody className="max-h-[min(80dvh,720px)] overflow-auto pt-0">
            <div className="flex min-h-48 justify-center [&_.mermaid]:my-0">
              <MermaidDiagram code={code} />
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
