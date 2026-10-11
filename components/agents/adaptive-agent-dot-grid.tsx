"use client";

import type { AgentDotState } from "./agent-dot-grid";
import type { ComponentType, ReactNode } from "react";

import { Component, useCallback, useEffect, useState } from "react";

import { AgentDotGrid } from "./agent-dot-grid";

import { getSettings, USER_SETTINGS_STORAGE_KEY } from "@/lib/user-settings";

type GridProps = { state?: AgentDotState; seed?: string };
type PhysicsGrid = ComponentType<GridProps & { onFailure: () => void }>;
const loadPhysicsGrid = () => import("./physics-agent-dot-grid");

class PhysicsBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Hydrates v0 first, then upgrades only while preferences and measured performance permit. */
export function AdaptiveAgentDotGrid({
  loadPhysics = loadPhysicsGrid,
  ...props
}: GridProps & {
  /** Renderer loader kept injectable for delivery/failure tests; public mark callers use the default. */
  loadPhysics?: () => Promise<{ PhysicsAgentDotGrid: PhysicsGrid }>;
}) {
  const [allowed, setAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [PhysicsGrid, setPhysicsGrid] = useState<PhysicsGrid | null>(null);
  const fail = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      try {
        setAllowed(
          !motion.matches &&
            !getSettings().lightweightMode &&
            typeof window.requestAnimationFrame === "function" &&
            typeof window.cancelAnimationFrame === "function" &&
            typeof IntersectionObserver !== "undefined"
        );
      } catch {
        setAllowed(false);
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === USER_SETTINGS_STORAGE_KEY || event.key === null) sync();
    };

    sync();
    motion.addEventListener("change", sync);
    window.addEventListener("organic-llm-settings", sync);
    window.addEventListener("storage", storage);

    return () => {
      motion.removeEventListener("change", sync);
      window.removeEventListener("organic-llm-settings", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  useEffect(() => {
    if (!allowed || failed || PhysicsGrid) return;
    let cancelled = false;

    loadPhysics()
      .then((module) => {
        if (!cancelled) setPhysicsGrid(() => module.PhysicsAgentDotGrid);
      })
      .catch(() => {
        if (!cancelled) fail();
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, failed, PhysicsGrid, fail, loadPhysics]);

  const fallback = <AgentDotGrid {...props} />;

  if (!allowed || failed || !PhysicsGrid) return fallback;

  return (
    <PhysicsBoundary fallback={fallback} onFailure={fail}>
      <PhysicsGrid {...props} onFailure={fail} />
    </PhysicsBoundary>
  );
}
