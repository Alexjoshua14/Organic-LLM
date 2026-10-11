"use client";

import type { AgentDotState } from "@/components/agents/organic-activity-mark";

import { useEffect, useRef, useState } from "react";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { glass } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { cn } from "@/lib/utils";

const STATES: { state: AgentDotState; label: string; description: string }[] = [
  { state: "idle", label: "Idle", description: "Soft, independent drift." },
  { state: "working", label: "Working", description: "More energy, faster targets." },
  { state: "waiting", label: "Waiting", description: "A slow, shared breath." },
  { state: "blocked", label: "Blocked", description: "Alternating groups pulse." },
  { state: "complete", label: "Complete", description: "A pulse, then back to rest." },
];
const SIZES = {
  compact: { label: "Compact · 28px", className: "size-7!" },
  card: { label: "Card · 40px", className: "size-10!" },
  large: { label: "Large · 56px", className: "size-14!" },
  inspect: { label: "Inspect · 112px", className: "size-28!" },
} as const;

type PreviewSize = keyof typeof SIZES;
type PreviewMode = "auto" | "v0" | "compare";
const MODES: { value: PreviewMode; label: string }[] = [
  { value: "auto", label: "Adaptive" },
  { value: "v0", label: "Original v0" },
  { value: "compare", label: "Compare" },
];
const BUTTON_CLASS =
  "min-h-10 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function MarkPreview({
  state,
  size,
  renderer,
  seed,
  replay,
}: {
  state: AgentDotState;
  size: PreviewSize;
  renderer: "auto" | "v0";
  seed: string;
  replay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeRenderer, setActiveRenderer] = useState("Original grid");

  useEffect(() => {
    const element = ref.current;

    if (!element) return;
    const sync = () => {
      setActiveRenderer(
        element.querySelector("[data-dot-renderer]")?.getAttribute("data-dot-renderer") ===
          "physics"
          ? "Physics dots"
          : "Original grid"
      );
    };
    const observer = new MutationObserver(sync);

    observer.observe(element, { childList: true, subtree: true });
    sync();

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="min-w-0">
      <div className="flex h-40 items-center justify-center">
        <OrganicActivityMark
          key={replay}
          className={SIZES[size].className}
          label={`${renderer === "auto" ? "Adaptive" : "Original"} ${state} activity mark`}
          renderer={renderer}
          seed={seed}
          state={state}
        />
      </div>
      <p className="pb-3 text-center text-[10px] text-muted-foreground/75">
        {renderer === "auto" ? "Adaptive" : "v0"} · {activeRenderer}
      </p>
    </div>
  );
}

export function OrganicActivityMarkLab() {
  const [size, setSize] = useState<PreviewSize>("large");
  const [mode, setMode] = useState<PreviewMode>("auto");
  const [pattern, setPattern] = useState(0);
  const [replay, setReplay] = useState(0);
  const [transitionReplay, setTransitionReplay] = useState(0);
  const [transitionState, setTransitionState] = useState<AgentDotState>("idle");
  const seed = `organic-agent-lab-${pattern}`;

  return (
    <Page className="items-stretch justify-start overflow-hidden">
      <div className="h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="6xl">
          <PageNavBack className="mb-8" href="/sandbox/prototypes">
            ← Prototypes
          </PageNavBack>
          <header className="mb-6">
            <h1 className="font-commissioner text-3xl font-light tracking-tight text-foreground">
              Organic Agent
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              ActivityMark in every state. The same dots, seed, and glass, with room to study the
              motion.
            </p>
          </header>

          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-3 text-xs text-muted-foreground">
              Size
              <select
                className={cn(
                  glass(),
                  "min-h-10 rounded-lg px-3 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                )}
                value={size}
                onChange={(event) => setSize(event.target.value as PreviewSize)}
              >
                {Object.entries(SIZES).map(([value, option]) => (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div
              aria-label="Renderer comparison"
              className={cn(glass(), "flex flex-wrap gap-1 rounded-xl p-1")}
              role="group"
            >
              {MODES.map(({ value, label }) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  className={cn(BUTTON_CLASS, mode === value && "bg-foreground/8 text-foreground")}
                  type="button"
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                className={BUTTON_CLASS}
                type="button"
                onClick={() => {
                  setReplay((value) => value + 1);
                  if (transitionState === "complete") setTransitionReplay((value) => value + 1);
                }}
              >
                Replay completion
              </button>
              <button
                className={BUTTON_CLASS}
                type="button"
                onClick={() => setPattern((value) => value + 1)}
              >
                New dot pattern
              </button>
            </div>
          </div>

          <section
            aria-label="All activity states"
            className={cn(
              glass(),
              "grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-5"
            )}
          >
            {STATES.map(({ state, label, description }) => (
              <div key={state} className="min-w-0 px-3 pt-4">
                <h2 className="text-center text-sm font-medium text-foreground">{label}</h2>
                <MarkPreview
                  renderer={mode === "v0" ? "v0" : "auto"}
                  replay={state === "complete" ? replay : 0}
                  seed={seed}
                  size={size}
                  state={state}
                />
                {mode === "compare" && (
                  <div className="border-t border-border/40">
                    <MarkPreview
                      renderer="v0"
                      replay={state === "complete" ? replay : 0}
                      seed={seed}
                      size={size}
                      state={state}
                    />
                  </div>
                )}
                <p className="min-h-12 text-center text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </section>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Adaptive uses physics when possible. Reduced Motion, Lightweight Mode, or sustained
            performance pressure keep the original grid.
          </p>

          <section
            aria-labelledby="transitions-title"
            className="mt-10 border-t border-border/50 pt-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="transitions-title" className="text-sm font-medium text-foreground">
                  State transitions
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Change state while the mark keeps moving.
                </p>
              </div>
              <div aria-label="Transition state" className="flex flex-wrap gap-1" role="group">
                {STATES.map(({ state, label }) => (
                  <button
                    key={state}
                    aria-pressed={transitionState === state}
                    className={cn(
                      BUTTON_CLASS,
                      transitionState === state && "bg-foreground/8 text-foreground"
                    )}
                    type="button"
                    onClick={() => {
                      if (state === "complete" && transitionState === "complete")
                        setTransitionReplay((value) => value + 1);
                      setTransitionState(state);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn("grid", mode === "compare" ? "grid-cols-2" : "grid-cols-1")}>
              <MarkPreview
                renderer={mode === "v0" ? "v0" : "auto"}
                replay={transitionReplay}
                seed={seed}
                size={size}
                state={transitionState}
              />
              {mode === "compare" && (
                <MarkPreview
                  renderer="v0"
                  replay={transitionReplay}
                  seed={seed}
                  size={size}
                  state={transitionState}
                />
              )}
            </div>
          </section>
        </PageContentFrame>
      </div>
    </Page>
  );
}
