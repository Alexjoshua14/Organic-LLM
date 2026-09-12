"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { MermaidDiagramDensity } from "@/lib/mermaid/types";

export type DiagramTakeoverState = {
  diagramId: string;
  title?: string;
  density: MermaidDiagramDensity;
  overviewCode: string;
  detailedCode: string;
  /** Measured inline rect at open time (viewport coords). */
  startRect: DOMRect;
  /** When set, focus this node in the takeover. */
  focusNodeId?: string;
  /** `reveal` = show detailed subgraph; `deepen` = model extends detailed. */
  mode: "expand" | "reveal" | "deepen";
};

type DiagramTakeoverContextValue = {
  takeover: DiagramTakeoverState | null;
  openTakeover: (state: DiagramTakeoverState) => void;
  closeTakeover: () => void;
  isDetailedView: boolean;
  setDetailedView: (v: boolean) => void;
};

const DiagramTakeoverContext = createContext<DiagramTakeoverContextValue | null>(null);

export function DiagramTakeoverProvider({ children }: { children: ReactNode }) {
  const [takeover, setTakeover] = useState<DiagramTakeoverState | null>(null);
  const [isDetailedView, setDetailedView] = useState(false);
  const historyPushedRef = useRef(false);

  const openTakeover = useCallback((state: DiagramTakeoverState) => {
    setTakeover(state);
    setDetailedView(state.mode !== "expand" || state.density === "detailed");

    if (typeof window !== "undefined" && !historyPushedRef.current) {
      const url = new URL(window.location.href);

      url.searchParams.set("diagram", state.diagramId);
      window.history.pushState({ diagramTakeover: state.diagramId }, "", url.toString());
      historyPushedRef.current = true;
    }
  }, []);

  const closeTakeover = useCallback(() => {
    setTakeover(null);
    setDetailedView(false);

    if (typeof window !== "undefined" && historyPushedRef.current) {
      window.history.back();
      historyPushedRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (historyPushedRef.current) {
        setTakeover(null);
        setDetailedView(false);
        historyPushedRef.current = false;
      }
    };

    window.addEventListener("popstate", onPop);

    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!takeover) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTakeover();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [takeover, closeTakeover]);

  const value = useMemo(
    () => ({
      takeover,
      openTakeover,
      closeTakeover,
      isDetailedView,
      setDetailedView,
    }),
    [takeover, openTakeover, closeTakeover, isDetailedView]
  );

  return (
    <DiagramTakeoverContext.Provider value={value}>{children}</DiagramTakeoverContext.Provider>
  );
}

export function useDiagramTakeover(): DiagramTakeoverContextValue {
  const ctx = useContext(DiagramTakeoverContext);

  if (!ctx) {
    throw new Error("useDiagramTakeover must be used within DiagramTakeoverProvider");
  }

  return ctx;
}

export function useDiagramTakeoverOptional(): DiagramTakeoverContextValue | null {
  return useContext(DiagramTakeoverContext);
}
