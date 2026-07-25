"use client";

import type { GenUIBlockType } from "@/lib/schemas/gen-ui/shared";

import { useCallback, useEffect, useRef } from "react";

type UseGenUiGalleryScrollOptions = {
  enabled: boolean;
  sectionTypes: GenUIBlockType[];
  selectedType: GenUIBlockType;
  onSelectType: (type: GenUIBlockType) => void;
};

/**
 * Reforge-style gallery paging: full-height snap sections + active index sync.
 * Uses native scroll-snap (not wheel hijacking) for nested panel safety.
 */
export function useGenUiGalleryScroll({
  enabled,
  sectionTypes,
  selectedType,
  onSelectType,
}: UseGenUiGalleryScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<GenUIBlockType, HTMLElement | null>>>({});
  const ratiosRef = useRef<Partial<Record<GenUIBlockType, number>>>({});
  const selectedTypeRef = useRef(selectedType);

  selectedTypeRef.current = selectedType;

  const scrollToType = useCallback((type: GenUIBlockType, behavior: ScrollBehavior = "smooth") => {
    const node = sectionRefs.current[type];

    if (!node) return;

    node.scrollIntoView({ behavior, block: "start" });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    scrollToType(selectedTypeRef.current, "auto");
  }, [enabled, scrollToType]);

  useEffect(() => {
    if (!enabled || !scrollRef.current) return;

    const root = scrollRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const type = entry.target.getAttribute("data-archetype") as GenUIBlockType | null;

          if (!type) continue;

          ratiosRef.current[type] = entry.intersectionRatio;
        }

        let bestType: GenUIBlockType | null = null;
        let bestRatio = 0;

        for (const type of sectionTypes) {
          const ratio = ratiosRef.current[type] ?? 0;

          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestType = type;
          }
        }

        if (bestType && bestRatio >= 0.45 && bestType !== selectedTypeRef.current) {
          onSelectType(bestType);
        }
      },
      {
        root,
        threshold: [0, 0.25, 0.45, 0.6, 0.75, 1],
      }
    );

    const nodes = root.querySelectorAll<HTMLElement>("[data-archetype]");

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [enabled, onSelectType, sectionTypes]);

  const registerSection = useCallback((type: GenUIBlockType) => {
    return (node: HTMLElement | null) => {
      sectionRefs.current[type] = node;
    };
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const type = sectionTypes[index];

      if (!type) return;

      onSelectType(type);
      scrollToType(type);
    },
    [onSelectType, scrollToType, sectionTypes]
  );

  const selectedIndex = Math.max(0, sectionTypes.indexOf(selectedType));

  return {
    scrollRef,
    registerSection,
    scrollToType,
    scrollToIndex,
    selectedIndex,
  };
}
