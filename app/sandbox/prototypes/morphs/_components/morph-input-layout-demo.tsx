"use client";

import {
  useMorphPhysics,
  type ShellLayoutInfo,
  type Vector4,
} from "@organic-llm/morph-physics/react";
import { snapshot } from "@organic-llm/morph-physics";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  morphSpringConfigForPlaybackPercent,
  type MorphDemoSpeedPercent,
} from "../_lib/morph-demo-spring-presets";

import { MorphDemoChatInput } from "./morph-demo-chat-input";
import { MorphDemoDevHud } from "./morph-demo-dev-hud";
import { MorphDemoHomeInput } from "./morph-demo-home-input";
import { MorphLiveMetricsSampler } from "./morph-live-metrics-sampler";
import { MorphDemoReactScan } from "./morph-demo-react-scan";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { clusterInsetX, triggerInsetX, triggerInsetY } from "@/lib/layout/nav-chrome";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

type Layout = "home" | "chat";

export function MorphInputLayoutDemo() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const homeGhostRef = useRef<HTMLDivElement | null>(null);
  const chatGhostRef = useRef<HTMLDivElement | null>(null);
  const variantRef = useRef<Layout>("home");
  const homeVecRef = useRef<Vector4 | null>(null);
  const chatVecRef = useRef<Vector4 | null>(null);
  const measuredTargetsRef = useRef<{ home: Vector4 | null; chat: Vector4 | null }>({
    home: null,
    chat: null,
  });
  const speedEffectPrimedRef = useRef(false);

  const [devHudExpanded, setDevHudExpanded] = useState(true);

  const [layout, setLayout] = useState<Layout>("home");
  const layoutRef = useRef<Layout>(layout);
  const [speedPercent, setSpeedPercent] = useState<MorphDemoSpeedPercent>(100);
  const [measuredTargets, setMeasuredTargets] = useState<{
    home: Vector4 | null;
    chat: Vector4 | null;
  }>({ home: null, chat: null });
  const [relaxHomeComposerMaxWidth, setRelaxHomeComposerMaxWidth] = useState(false);

  const springConfig = useMemo(
    () => morphSpringConfigForPlaybackPercent(speedPercent),
    [speedPercent]
  );

  const onShellLayout = useCallback((info: ShellLayoutInfo) => {
    if (variantRef.current !== "home") {
      setRelaxHomeComposerMaxWidth(false);

      return;
    }
    setRelaxHomeComposerMaxWidth(info.relaxation.width);
  }, []);

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: springConfig,
    onShellLayout,
  });

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const applyLayout = useCallback(
    (next: Layout) => {
      const hv = homeVecRef.current;
      const cv = chatVecRef.current;

      if (!hv || !cv) return;
      variantRef.current = next;
      setLayout(next);
      const target = next === "home" ? hv : cv;

      morphTo(target);
    },
    [morphTo]
  );

  const measureAndSync = useCallback(() => {
    const stage = stageRef.current;
    const homeEl = homeGhostRef.current;
    const chatEl = chatGhostRef.current;

    if (!stage || !homeEl || !chatEl) return;

    const hv = snapshot(homeEl, stage);
    const cv = snapshot(chatEl, stage);

    homeVecRef.current = hv;
    chatVecRef.current = cv;

    measuredTargetsRef.current = { home: { ...hv }, chat: { ...cv } };
    setMeasuredTargets({ home: { ...hv }, chat: { ...cv } });

    const current = variantRef.current === "home" ? hv : cv;

    reset(current);
  }, [reset]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      measureAndSync();
    });

    return () => cancelAnimationFrame(id);
  }, [measureAndSync]);

  useEffect(() => {
    variantRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !e.shiftKey) {
        return;
      }
      e.preventDefault();
      const next = layoutRef.current === "home" ? "chat" : "home";

      applyLayout(next);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyLayout]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        measureAndSync();
      });
    });

    ro.observe(stage);

    return () => ro.disconnect();
  }, [measureAndSync]);

  useEffect(() => {
    if (!speedEffectPrimedRef.current) {
      speedEffectPrimedRef.current = true;

      return;
    }
    const hv = homeVecRef.current;
    const cv = chatVecRef.current;

    if (!hv || !cv) return;
    morphTo(layoutRef.current === "home" ? hv : cv);
  }, [speedPercent, morphTo]);

  const onToggleMorph = () => {
    applyLayout(layout === "home" ? "chat" : "home");
  };

  return (
    <Page liquidChromeBackground transparentBackground className="items-stretch justify-start gap-0 overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div
        aria-hidden
        className={cn(
          glass({ border: "none", opaque: true }),
          "pointer-events-none absolute inset-0 z-[1] min-h-dvh w-full rounded-none"
        )}
      />
      <MorphDemoReactScan debugPanelExpanded={devHudExpanded} />
      <MorphLiveMetricsSampler
        elementRef={elementRef}
        layoutRef={layoutRef}
        measuredTargetsRef={measuredTargetsRef}
        resolveTarget={(lay, t) => (lay === "home" ? t.home : t.chat)}
        stageRef={stageRef}
      >
        {(live) => (
          <MorphDemoDevHud
            layout={layout}
            live={live}
            speedPercent={speedPercent}
            spring={springConfig}
            targetLabelAlpha="home"
            targetLabelBeta="chat"
            targets={{ alpha: measuredTargets.home, beta: measuredTargets.chat }}
            onPanelOpenChange={setDevHudExpanded}
            onSpeedChange={setSpeedPercent}
          />
        )}
      </MorphLiveMetricsSampler>
      <div className={cn("relative z-10 flex h-full min-h-0 w-full flex-col", triggerInsetY)}>
        <nav
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1",
            triggerInsetX,
            clusterInsetX
          )}
        >
          <Link
            className="text-sm text-muted-foreground transition-colors select-none hover:text-foreground"
            href="/sandbox/prototypes"
          >
            ← Prototypes
          </Link>
          <Link
            className="text-sm text-muted-foreground transition-colors select-none hover:text-foreground"
            href="/sandbox/prototypes/morphs/chat-archetype"
          >
            Chat ↔ rabbit morph
          </Link>
        </nav>
        <header
          className={cn(
            "shrink-0 px-4 pt-4 text-center",
            devHudExpanded ? "pr-[min(18rem,100vw-1rem)] sm:pr-4" : "pr-4"
          )}
        >
          <h1 className="font-commissioner text-2xl font-light tracking-tight text-foreground">
            Morph: homepage ↔ chat input
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Layout positions are measured from hidden references; the visible block is driven by{" "}
            <code className="rounded bg-muted/50 px-1 py-0.5 text-xs">
              @organic-llm/morph-physics
            </code>
            . Press{" "}
            <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
              Shift
            </kbd>
            {" + "}
            <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
              Tab
            </kbd>{" "}
            or use the button below. Use the debug panel (top right) for playback speed and metrics;
            collapse it with the chevron when you need space. In development, React Scan adds a
            toolbar with live FPS.
          </p>
        </header>

        <div
          ref={stageRef}
          className="relative mt-4 min-h-[min(72vh,640px)] w-full flex-1 px-2 sm:px-4"
        >
          <div
            ref={homeGhostRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-[38%] z-0 w-[calc(100%-1.5rem)] max-w-xl",
              "-translate-x-1/2 -translate-y-1/2 opacity-0"
            )}
          >
            <MorphDemoHomeInput />
          </div>
          <div
            ref={chatGhostRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute right-4 bottom-24 left-4 z-0 opacity-0 sm:left-8 sm:right-8"
            )}
          >
            <MorphDemoChatInput className="w-full" />
          </div>

          <div
            ref={elementRef}
            className={cn(
              "pointer-events-auto absolute top-0 left-0 z-20 overflow-hidden rounded-xl",
              "border-0 bg-transparent shadow-none backdrop-blur-none will-change-[transform,width,height]"
            )}
          >
            {layout === "home" ? (
              <div
                className={cn(
                  "min-h-full",
                  relaxHomeComposerMaxWidth ? "w-full min-w-0" : "w-full max-w-xl"
                )}
              >
                <MorphDemoHomeInput
                  className="min-h-full"
                  relaxMaxWidthWhileMorphing={relaxHomeComposerMaxWidth}
                />
              </div>
            ) : (
              <MorphDemoChatInput className="min-h-full w-full" />
            )}
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <Button
            className="pointer-events-auto shadow-lg"
            type="button"
            variant="secondary"
            onClick={onToggleMorph}
          >
            {layout === "home" ? "Morph to chat input" : "Morph to homepage input"}
          </Button>
        </div>
      </div>
    </Page>
  );
}
