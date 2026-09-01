"use client";

import { snapshot, type Vector4 } from "@organic-llm/morph-physics";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

import { RABBIT_HOLE_COMPOSER_MORPH_SPRING } from "@/lib/rabbit-holes/desktop-chat-morph-springs";
import { cn } from "@/lib/utils";

type RabbitHoleMorphStableItemProps = {
  morphId: string;
  chatOpen: boolean;
  stageRef: React.RefObject<HTMLElement | null>;
  collapsedRef: React.RefObject<HTMLElement | null>;
  openRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
};

export function RabbitHoleMorphStableItem({
  morphId,
  chatOpen,
  stageRef,
  collapsedRef,
  openRef,
  children,
  className,
}: RabbitHoleMorphStableItemProps) {
  const reduceMotion = useReducedMotion();
  const collapsedVec = useRef<Vector4 | null>(null);
  const openVec = useRef<Vector4 | null>(null);

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: RABBIT_HOLE_COMPOSER_MORPH_SPRING,
  });

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const collapsedEl = collapsedRef.current;
    const openEl = openRef.current;

    if (!stage || !collapsedEl || !openEl) return;

    collapsedVec.current = snapshot(collapsedEl, stage);
    openVec.current = snapshot(openEl, stage);

    const target = chatOpen ? openVec.current : collapsedVec.current;

    if (reduceMotion) {
      reset(target);
    } else {
      morphTo(target);
    }
  }, [chatOpen, morphTo, openRef, collapsedRef, reduceMotion, reset, stageRef]);

  useLayoutEffect(() => {
    measure();
  }, [chatOpen, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      ref={elementRef}
      className={cn(className)}
      data-morph-id={morphId}
    >
      {children}
    </div>
  );
}
