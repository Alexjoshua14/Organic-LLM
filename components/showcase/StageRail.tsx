"use client";

import type { ShowcaseStage } from "@/lib/showcase/showcase-trace";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { StagePanel } from "./StagePanel";

type StageRailProps = {
  stages: readonly ShowcaseStage[];
  onActiveStageChange: (index: number) => void;
};

export function StageRail({ stages, onActiveStageChange }: StageRailProps) {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let innerRaf: number | null = null;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (cancelled) return;
        const els = sectionRefs.current.filter(Boolean) as HTMLElement[];

        if (els.length === 0) return;

        observer = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.2)
              .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

            if (!visible?.target) return;
            const idx = els.indexOf(visible.target as HTMLElement);

            if (idx >= 0) onActiveStageChange(idx);
          },
          { root: null, rootMargin: "-18% 0px -32% 0px", threshold: [0.2, 0.35, 0.5, 0.65] }
        );

        els.forEach((el) => observer?.observe(el));
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      if (innerRaf != null) cancelAnimationFrame(innerRaf);
      observer?.disconnect();
    };
  }, [onActiveStageChange, stages]);

  return (
    <motion.div
      className="flex flex-col gap-10 pb-24"
      initial={reduceMotion ? false : { opacity: 0.92 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {stages.map((stage, index) => (
        <StagePanel
          key={stage.id}
          index={index}
          sectionRef={(el) => {
            sectionRefs.current[index] = el;
          }}
          stage={stage}
        />
      ))}
    </motion.div>
  );
}
