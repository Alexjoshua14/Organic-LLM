"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { DIAGRAM_NODE_LINK_CAP, type DiagramNodeLink } from "@/lib/mermaid/types";

type DiagramNodeLinksContextValue = {
  links: DiagramNodeLink[];
  addLink: (link: Omit<DiagramNodeLink, "id">) => void;
  removeLink: (id: string) => void;
  clearLinks: () => void;
};

const DiagramNodeLinksContext = createContext<DiagramNodeLinksContextValue | null>(null);

export function DiagramNodeLinksProvider({
  children,
  linksRef,
}: {
  children: ReactNode;
  /** Optional ref synced on every links change (for transport body assembly). */
  linksRef?: MutableRefObject<DiagramNodeLink[]>;
}) {
  const [links, setLinks] = useState<DiagramNodeLink[]>([]);

  useEffect(() => {
    if (linksRef) linksRef.current = links;
  }, [links, linksRef]);

  const addLink = useCallback((link: Omit<DiagramNodeLink, "id">) => {
    setLinks((prev) => {
      if (prev.some((l) => l.diagramId === link.diagramId && l.nodeId === link.nodeId)) {
        return prev;
      }

      if (prev.length >= DIAGRAM_NODE_LINK_CAP) {
        toast.message(`At most ${DIAGRAM_NODE_LINK_CAP} diagram nodes can be linked at once.`);

        return prev;
      }

      return [...prev, { ...link, id: `${link.diagramId}:${link.nodeId}:${Date.now()}` }];
    });
  }, []);

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearLinks = useCallback(() => setLinks([]), []);

  const value = useMemo(
    () => ({ links, addLink, removeLink, clearLinks }),
    [links, addLink, removeLink, clearLinks]
  );

  return (
    <DiagramNodeLinksContext.Provider value={value}>{children}</DiagramNodeLinksContext.Provider>
  );
}

export function useDiagramNodeLinks(): DiagramNodeLinksContextValue {
  const ctx = useContext(DiagramNodeLinksContext);

  if (!ctx) {
    throw new Error("useDiagramNodeLinks must be used within DiagramNodeLinksProvider");
  }

  return ctx;
}

export function useDiagramNodeLinksOptional(): DiagramNodeLinksContextValue | null {
  return useContext(DiagramNodeLinksContext);
}
