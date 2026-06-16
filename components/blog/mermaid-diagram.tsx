"use client";

import { Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from "@heroui/modal";
import mermaid from "mermaid";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

/** LLM output can include init directives that set securityLevel to strict; that triggers DOMPurify.sanitize, which is missing in some environments (minified as tb.sanitize). */
function stripSecurityLevelInitDirectives(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trim();

      if (!t.startsWith("%%")) return true;
      if (!/init\s*:/i.test(t)) return true;

      return !/securityLevel/i.test(t);
    })
    .join("\n");
}

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

    if (root && nodes) {
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
    if (!code || !containerRef.current) return;
    const epoch = ++renderEpochRef.current;
    const safeCode = stripSecurityLevelInitDirectives(code);

    let cancelled = false;

    setError(null);
    containerRef.current.innerHTML = "";

    const renderOnce = async (diagramCode: string) => {
      // Re-apply before every render so init directives or internal resets cannot force strict + DOMPurify.
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
      });

      await mermaid.parse(diagramCode);
      const renderId = `mermaid-${Date.now()}-${epoch}`;
      const renderResult = await mermaid.render(renderId, diagramCode);
      const svgMarkup =
        typeof renderResult === "string" ? renderResult : (renderResult as { svg?: string })?.svg;

      if (!svgMarkup) {
        throw new Error("Mermaid render returned empty SVG.");
      }

      if (cancelled || renderEpochRef.current !== epoch || !containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = svgMarkup;
      const svg = containerRef.current.querySelector("svg");

      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Diagram");
        applyGlassStylingToSvg(svg as SVGSVGElement);
      }
    };

    const run = async () => {
      try {
        await renderOnce(safeCode);
      } catch (firstErr) {
        // First-load Mermaid occasionally fails in hydration races; retry once on next tick.
        await new Promise((resolve) => setTimeout(resolve, 30));
        try {
          await renderOnce(safeCode);
        } catch (retryErr) {
          const bestError = toRenderErrorMessage(retryErr) || toRenderErrorMessage(firstErr);

          if (!cancelled && renderEpochRef.current === epoch) {
            setError(bestError);
          }
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        Diagram could not be rendered: {error}
      </div>
    );
  }

  const diagram = (
    <div
      ref={containerRef}
      aria-label={
        expandOnDoubleClick ? "Diagram — double-click or press Enter to enlarge" : undefined
      }
      className={cn(
        "mermaid my-4 flex justify-center overflow-x-auto [&_svg]:max-w-full",
        expandOnDoubleClick &&
          "cursor-zoom-in select-none rounded-md outline-none ring-offset-2 transition-shadow hover:ring-2 hover:ring-border/60 focus-visible:ring-2 focus-visible:ring-ring"
      )}
      role={expandOnDoubleClick ? "button" : undefined}
      tabIndex={expandOnDoubleClick ? 0 : undefined}
      onDoubleClick={expandOnDoubleClick ? onOpen : undefined}
      onKeyDown={expandOnDoubleClick ? handleExpandedKeyDown : undefined}
    />
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
