"use client";

import { snapshot, regular_spring_config } from "@organic-llm/morph-physics";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { useReducedMotion } from "framer-motion";
import { Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { useSidebar } from "@/components/third-party/ui/sidebar";
import { useDiagramTakeover } from "@/lib/mermaid/diagram-takeover-context";
import { cn } from "@/lib/utils";

export function DiagramTakeoverShell() {
  const { takeover, closeTakeover, isDetailedView } = useDiagramTakeover();
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion === true;
  const { setOpen, setOpenMobile, isMobile } = useSidebar();

  const stageRef = useRef<HTMLDivElement>(null);
  const startGhostRef = useRef<HTMLDivElement>(null);
  const endGhostRef = useRef<HTMLDivElement>(null);
  const startRectRef = useRef(takeover?.startRect ?? null);
  const sidebarWasOpenRef = useRef<boolean | null>(null);

  const { elementRef, reset, morphTo } = useMorphPhysics({ config: regular_spring_config });

  useEffect(() => {
    if (!takeover) return;

    startRectRef.current = takeover.startRect;

    if (sidebarWasOpenRef.current === null) {
      sidebarWasOpenRef.current = true;
      if (isMobile) setOpenMobile(false);
      else setOpen(false);
    }
  }, [takeover, isMobile, setOpen, setOpenMobile]);

  const handleClose = useCallback(() => {
    if (sidebarWasOpenRef.current) {
      if (isMobile) setOpenMobile(true);
      else setOpen(true);
      sidebarWasOpenRef.current = null;
    }
    closeTakeover();
  }, [closeTakeover, isMobile, setOpen, setOpenMobile]);

  const measureAndMorph = useCallback(() => {
    const stage = stageRef.current;
    const startGhost = startGhostRef.current;
    const endGhost = endGhostRef.current;
    const startRect = startRectRef.current;

    if (!stage || !startGhost || !endGhost || !startRect) return;

    const stageBox = stage.getBoundingClientRect();
    const startVec = {
      x: startRect.left - stageBox.left,
      y: startRect.top - stageBox.top,
      w: startRect.width,
      h: startRect.height,
    };

    const endVec = snapshot(endGhost, stage);

    if (reduce) {
      reset(endVec);

      return;
    }

    reset(startVec);
    morphTo(endVec);
  }, [morphTo, reduce, reset]);

  useLayoutEffect(() => {
    if (!takeover) return;

    const id = requestAnimationFrame(() => measureAndMorph());

    return () => cancelAnimationFrame(id);
  }, [takeover, measureAndMorph, isDetailedView]);

  if (!takeover) return null;

  const activeCode = isDetailedView ? takeover.detailedCode : takeover.overviewCode;

  // Portaled to <body>: mounted inside the chat it sat in an `overflow-hidden` shell with its own
  // stacking context, where the app chrome could cover the close control and leave no way out.
  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex flex-col bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-label={takeover.title ?? "Diagram"}
    >
      {/* viewport-fit=cover draws under the notch and home bar, so both edges pad by the safe area. */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 pb-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Diagram</p>
          {takeover.title ? (
            <h2 className="truncate text-sm font-medium text-foreground">{takeover.title}</h2>
          ) : null}
        </div>
        <button
          aria-label="Close diagram"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border/50 px-3 text-sm text-foreground hover:bg-background-tertiary/60 sm:h-8 sm:px-2 sm:text-muted-foreground sm:hover:text-foreground"
          type="button"
          onClick={handleClose}
        >
          <X className="size-4" />
          <span className="sm:sr-only">Close</span>
        </button>
      </header>

      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        {/* Ghost anchors for morph measurement */}
        <div
          ref={startGhostRef}
          aria-hidden
          className="pointer-events-none absolute opacity-0"
          style={{
            left: startRectRef.current
              ? startRectRef.current.left - (stageRef.current?.getBoundingClientRect().left ?? 0)
              : 0,
            top: startRectRef.current
              ? startRectRef.current.top - (stageRef.current?.getBoundingClientRect().top ?? 0)
              : 0,
            width: startRectRef.current?.width ?? 0,
            height: startRectRef.current?.height ?? 0,
          }}
        />
        <div
          ref={endGhostRef}
          aria-hidden
          className="pointer-events-none absolute inset-2 opacity-0 sm:inset-4 max-sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
        />

        <div
          ref={elementRef}
          className={cn(
            "absolute inset-2 overflow-auto rounded-lg sm:inset-4 max-sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
            "bg-background-tertiary/20 ring-1 ring-inset ring-border/40"
          )}
        >
          <MermaidDiagram
            code={activeCode}
            density={takeover.density}
            detailedCode={takeover.detailedCode}
            diagramId={takeover.diagramId}
            interactive
            overviewCode={takeover.overviewCode}
            title={takeover.title}
            variant="takeover"
          />
        </div>
      </div>

      {/* Thumb reach on a phone: the same exit again at the bottom, above the home indicator. */}
      <button
        aria-hidden
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-background/95 px-5 text-sm font-medium text-foreground shadow-md backdrop-blur-md sm:hidden"
        tabIndex={-1}
        type="button"
        onClick={handleClose}
      >
        <Minimize2 className="size-4" />
        Minimize
      </button>
    </div>,
    document.body
  );
}
