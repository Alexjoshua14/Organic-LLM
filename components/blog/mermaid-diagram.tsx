"use client";

import mermaid from "mermaid";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { MermaidDiagramControls } from "@/components/mermaid/mermaid-diagram-controls";
import { MermaidNodePopover } from "@/components/mermaid/mermaid-node-popover";
import { ensureMermaidDomPurify, sanitizeMermaidSvgMarkup } from "@/lib/html/sanitize";
import { useDiagramNodeLinksOptional } from "@/lib/mermaid/diagram-node-links-context";
import { useDiagramTakeoverOptional } from "@/lib/mermaid/diagram-takeover-context";
import { buildNodeNeighborhood, extractNodeLabel } from "@/lib/mermaid/node-graph";
import {
  applyMermaidGlassStyles,
  mermaidRevealClass,
  mermaidWellClass,
  mermaidWellInnerClass,
  resolveMermaidFontFamily,
} from "@/lib/mermaid/presentation";
import { normalizeMermaidCode } from "@/lib/mermaid/source";
import type { MermaidDiagramDensity } from "@/lib/mermaid/types";
import { cn } from "@/lib/utils";

let mermaidInitialized = false;

function initializeMermaidOnce() {
  if (mermaidInitialized) return;
  mermaidInitialized = true;

  ensureMermaidDomPurify();
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "strict",
    suppressErrorRendering: true,
    fontFamily: resolveMermaidFontFamily(),
  });
}

let mermaidRenderQueue: Promise<unknown> = Promise.resolve();

function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const result = mermaidRenderQueue.then(task, task);

  mermaidRenderQueue = result.catch(() => {});

  return result;
}

const STALE_RENDER = Symbol("stale-mermaid-render");
type MermaidRenderOutcome = Awaited<ReturnType<typeof mermaid.render>> | typeof STALE_RENDER;

const ERROR_GRACE_MS = 400;

export type MermaidDiagramProps = {
  code: string;
  overviewCode?: string;
  detailedCode?: string;
  diagramId?: string;
  title?: string;
  density?: MermaidDiagramDensity;
  /** When true (e.g. Arcadia chat), double-click also opens expand. */
  expandOnDoubleClick?: boolean;
  interactive?: boolean;
  variant?: "inline" | "takeover";
};

export function MermaidDiagram({
  code,
  overviewCode,
  detailedCode,
  diagramId: diagramIdProp,
  title,
  density = "overview",
  expandOnDoubleClick = false,
  interactive = false,
  variant = "inline",
}: MermaidDiagramProps) {
  const wellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderEpochRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [popover, setPopover] = useState<{
    x: number;
    y: number;
    nodeId: string;
    label: string;
  } | null>(null);

  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const diagramId = diagramIdProp ?? `diagram-${instanceId}`;
  const takeover = useDiagramTakeoverOptional();
  const nodeLinks = useDiagramNodeLinksOptional();

  const inlineSource = overviewCode ?? code;
  const fullSource = detailedCode ?? overviewCode ?? code;
  const renderSource = variant === "takeover" && detailedCode ? detailedCode : inlineSource;

  const applyMindmapLayering = (svgEl: SVGSVGElement) => {
    const root = svgEl.querySelector(":scope > g");
    const edgePaths = svgEl.querySelector(".edgePaths");
    const edgeLabels = svgEl.querySelector(".edgeLabels");
    const nodes = svgEl.querySelector(".nodes");

    if (edgePaths) {
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

    if (root && nodes && nodes.parentNode === root) {
      if (edgePaths) root.insertBefore(edgePaths, nodes);
      if (edgeLabels) root.insertBefore(edgeLabels, nodes);
    }
  };

  const wireNodeInteractions = useCallback(
    (svgEl: SVGSVGElement, source: string) => {
      if (!interactive) return;

      svgEl.querySelectorAll("g.node").forEach((nodeEl) => {
        const g = nodeEl as SVGGElement;
        const nodeId = g.id?.replace(/^flowchart-|-\d+$/g, "").split("-").pop();

        if (!nodeId) return;

        g.style.cursor = "pointer";
        g.setAttribute("data-mermaid-node-id", nodeId);

        g.addEventListener("click", (e) => {
          e.stopPropagation();
          const label = extractNodeLabel(source, nodeId);

          setPopover({ x: e.clientX, y: e.clientY, nodeId, label });
        });
      });
    },
    [interactive]
  );

  useEffect(() => {
    if (!renderSource) return;
    const epoch = ++renderEpochRef.current;
    const safeCode = normalizeMermaidCode(renderSource);

    let cancelled = false;
    const isCurrent = () => !cancelled && renderEpochRef.current === epoch;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const renderOnce = async (diagramCode: string) => {
      initializeMermaidOnce();

      if (!isCurrent()) return;

      const renderId = `mermaid-${instanceId}-${epoch}`;
      const renderResult = await enqueueMermaidRender<MermaidRenderOutcome>(() =>
        isCurrent() ? mermaid.render(renderId, diagramCode) : Promise.resolve(STALE_RENDER)
      );

      if (renderResult === STALE_RENDER) return;

      const svgMarkup =
        typeof renderResult === "string" ? renderResult : (renderResult as { svg?: string })?.svg;

      if (!svgMarkup) throw new Error("Mermaid render returned empty SVG.");

      const safeSvgMarkup = sanitizeMermaidSvgMarkup(svgMarkup);

      if (!isCurrent() || !containerRef.current) return;

      containerRef.current.innerHTML = safeSvgMarkup;
      const svg = containerRef.current.querySelector("svg");

      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", title ?? "Diagram");
        try {
          applyMermaidGlassStyles(svg as SVGSVGElement);
          applyMindmapLayering(svg as SVGSVGElement);
          wireNodeInteractions(svg as SVGSVGElement, diagramCode);
        } catch {
          /* keep rendered SVG */
        }
      }

      if (isCurrent()) {
        setRevealed(true);
      }
    };

    const run = async () => {
      setRevealed(false);
      try {
        await renderOnce(safeCode);
        if (isCurrent()) setError(null);
      } catch (firstErr) {
        await wait(30);
        if (!isCurrent()) return;
        try {
          await renderOnce(safeCode);
          if (isCurrent()) setError(null);
        } catch (retryErr) {
          const bestError = toRenderErrorMessage(retryErr) || toRenderErrorMessage(firstErr);

          await wait(ERROR_GRACE_MS);
          if (!isCurrent()) return;
          if (containerRef.current) containerRef.current.innerHTML = "";
          setError(bestError);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [renderSource, instanceId, title, wireNodeInteractions]);

  const handleExpand = useCallback(() => {
    const rect = wellRef.current?.getBoundingClientRect();

    if (!rect || !takeover) {
      toast.message("Expand is available in chat.");

      return;
    }

    takeover.openTakeover({
      diagramId,
      title,
      density,
      overviewCode: inlineSource,
      detailedCode: fullSource,
      startRect: rect,
      mode: "expand",
    });
  }, [takeover, diagramId, title, density, inlineSource, fullSource]);

  const handleCopySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullSource);
      toast.success("Mermaid source copied");
    } catch {
      toast.error("Could not copy source");
    }
  }, [fullSource]);

  const handleDownloadSvg = useCallback(() => {
    const svg = containerRef.current?.querySelector("svg");

    if (!svg) return;

    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${diagramId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagramId]);

  const handleExpandedKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (expandOnDoubleClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        handleExpand();
      }
    },
    [expandOnDoubleClick, handleExpand]
  );

  const showControls = variant === "inline" && interactive;

  return (
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
        ref={wellRef}
        className={cn(
          mermaidWellClass,
          variant === "takeover" && "my-0 shadow-none",
          error && "hidden"
        )}
      >
        {showControls ? (
          <MermaidDiagramControls
            onCopySource={handleCopySource}
            onDownloadSvg={handleDownloadSvg}
            onExpand={handleExpand}
          />
        ) : null}

        <div
          className={cn(
            mermaidWellInnerClass,
            revealed && mermaidRevealClass,
            !revealed && "opacity-0"
          )}
        >
          <div
            ref={containerRef}
            aria-label={
              expandOnDoubleClick || interactive
                ? "Diagram — double-click or press Enter to enlarge"
                : undefined
            }
            className={cn(
              "mermaid flex min-w-0 justify-center",
              (expandOnDoubleClick || interactive) &&
                "cursor-zoom-in select-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            role={expandOnDoubleClick || interactive ? "button" : undefined}
            tabIndex={expandOnDoubleClick || interactive ? 0 : undefined}
            onDoubleClick={expandOnDoubleClick || interactive ? handleExpand : undefined}
            onKeyDown={expandOnDoubleClick || interactive ? handleExpandedKeyDown : undefined}
          />
        </div>
      </div>

      {popover && nodeLinks ? (
        <MermaidNodePopover
          label={popover.label}
          x={popover.x}
          y={popover.y}
          onChatAbout={() => {
            nodeLinks.addLink({
              diagramId,
              nodeId: popover.nodeId,
              label: popover.label,
              title,
              density,
              neighborhood: buildNodeNeighborhood(fullSource, popover.nodeId),
            });
            toast.success(`Linked "${popover.label}" to your next message`);
            setPopover(null);
          }}
          onClose={() => setPopover(null)}
          onExpandBranch={() => {
            const rect = wellRef.current?.getBoundingClientRect();

            if (rect && takeover) {
              takeover.openTakeover({
                diagramId,
                title,
                density,
                overviewCode: inlineSource,
                detailedCode: fullSource,
                startRect: rect,
                focusNodeId: popover.nodeId,
                mode: takeover.isDetailedView ? "deepen" : "reveal",
              });
            }
            setPopover(null);
          }}
          onExplain={() => {
            toast.message(`Explain: ${popover.label} (coming soon)`);
            setPopover(null);
          }}
          onRabbitHole={() => {
            toast.message(`Rabbit hole: ${popover.label} (coming soon)`);
            setPopover(null);
          }}
        />
      ) : null}
    </>
  );
}

function toRenderErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err == null) return "Unknown Mermaid render error";

  try {
    const asJson = JSON.stringify(err);

    return asJson && asJson !== "{}" ? asJson : String(err);
  } catch {
    return String(err);
  }
}
