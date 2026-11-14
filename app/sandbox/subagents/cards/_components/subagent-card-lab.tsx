"use client";

import type { ComponentType, ReactNode } from "react";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { NextSubagentCard } from "./next-subagent-card";
import { StateSelector } from "./state-selector";

import { SubagentCard } from "@/app/sandbox/arcadia/_components/subagent-card";
import { Switch } from "@/components/design-system/switch";
import { MULTITASK_DESKTOP_AGENT_COL_MAX_PX } from "@/lib/arcadia/multitask/layout-mode";
import { models } from "@/lib/schemas/chat";

const MOBILE_SAMPLE_WIDTH_PX = 390;
const AUTO_CYCLE_INTERVAL_MS = 2_000;
const CYCLE_STATES: ArcadiaSubagent["status"][] = ["idle", "working", "blocked", "done"];
const CONTROL_SWITCH_CLASSES = {
  base: "m-0 w-full max-w-none flex-col-reverse justify-center gap-stack-sm p-0",
  wrapper: "mr-0",
  label: "ml-0 whitespace-nowrap text-xs text-muted-foreground",
};

/** Fit the entire sample without changing its internal layout or cropping its controls. */
function FitPreview({ width, children }: { width: number; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const available = frame.current?.clientWidth || width;
      const height = content.current?.offsetHeight ?? 0;
      const scale = Math.min(1, available / width);

      setSize((previous) =>
        previous.scale === scale && previous.height === height ? previous : { scale, height }
      );
    };
    const observer = new ResizeObserver(measure);

    if (frame.current) observer.observe(frame.current);
    if (content.current) observer.observe(content.current);
    measure();

    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={frame} className="w-full">
      <div
        className="mx-auto"
        style={{
          width: width * size.scale,
          height: size.height ? size.height * size.scale : undefined,
        }}
      >
        <div
          ref={content}
          style={{ width, transform: `scale(${size.scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SampleCaption({ children }: { children: ReactNode }) {
  return (
    <p className="mb-stack-xs text-[10px] leading-tight text-muted-foreground/45">{children}</p>
  );
}

function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <div
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("a")) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}

const AGENT: ArcadiaSubagent = {
  id: "card-lab-researcher",
  name: "Lyra",
  role: "Researcher",
  blurb: "Researches sources",
  goal: "Review sources",
  progress: "Reading sources",
  progressPct: 0,
  status: "working",
  milestones: [],
  voiceId: "coral",
  activitySeed: "subagent-card-lab",
  modelId: models.anthropic.sonnet.id,
  threadId: "card-lab-preview",
};

const VERSIONS = [
  { name: "Current", Card: SubagentCard },
  { name: "Next", Card: NextSubagentCard },
] satisfies Array<{
  name: string;
  Card: ComponentType<Parameters<typeof SubagentCard>[0]>;
}>;

/**
 * Both versions share fixtures and controls; only Next's card markup is edited in this lab.
 * Design changes go to the Next files; "promote" copies Next over Current and keeps this page.
 * See docs/design/subagent-card-lab.md.
 */
export function SubagentCardLab() {
  const [status, setStatus] = useState<ArcadiaSubagent["status"]>("working");
  const [autoCycle, setAutoCycle] = useState(false);
  const [selected, setSelected] = useState(false);
  const [calling, setCalling] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const agent = { ...AGENT, status };
  const phase = calling ? "live" : "idle";
  const endCall = () => {
    setCalling(false);
    setStartedAt(null);
  };
  const startCall = () => {
    setStartedAt(Date.now());
    setCalling(true);
  };
  const cardProps = {
    agent,
    localStream: null,
    remoteStream: null,
    selected,
    speakPhase: phase,
    startedAt,
    voicePhase: "idle" as const,
    onEndSpeak: endCall,
    onSelect: () => setSelected((value) => !value),
    onSpeakTo: startCall,
  };

  useEffect(() => {
    if (!autoCycle) return;
    const timer = window.setInterval(() => {
      setStatus(
        (current) => CYCLE_STATES[(CYCLE_STATES.indexOf(current) + 1) % CYCLE_STATES.length]
      );
    }, AUTO_CYCLE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [autoCycle]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-x-inline-lg gap-y-stack-md sm:grid-cols-2 sm:gap-y-stack-lg">
      <section
        aria-label="Preview controls"
        className="col-span-full mx-auto flex w-full max-w-xl flex-col items-center gap-stack-sm rounded-xl border border-border/50 bg-background/40 p-inset-md"
      >
        <StateSelector value={status} onChange={setStatus} />
        <div className="grid w-full grid-cols-3 gap-inline-sm border-t border-border/40 pt-inset-md">
          <Switch
            classNames={CONTROL_SWITCH_CLASSES}
            isSelected={autoCycle}
            onValueChange={setAutoCycle}
          >
            Auto cycle
          </Switch>
          <Switch
            classNames={CONTROL_SWITCH_CLASSES}
            isSelected={selected}
            onValueChange={setSelected}
          >
            Selected
          </Switch>
          <Switch
            classNames={CONTROL_SWITCH_CLASSES}
            isSelected={calling}
            onValueChange={(active) => (active ? startCall() : endCall())}
          >
            Call active
          </Switch>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/70">Calls are simulated</p>
      </section>

      {VERSIONS.map(({ name, Card }) => (
        <section key={name} aria-label={`${name} version`} className="min-w-0">
          <h2 className="mb-stack-xs text-base font-semibold tracking-tight sm:mb-stack-sm sm:text-lg">
            {name}
          </h2>
          <div className="space-y-stack-md sm:space-y-stack-lg">
            <section aria-label={`${name} desktop card`}>
              <SampleCaption>Desktop · {MULTITASK_DESKTOP_AGENT_COL_MAX_PX}px</SampleCaption>
              <FitPreview width={MULTITASK_DESKTOP_AGENT_COL_MAX_PX}>
                <PreviewShell>
                  <Card {...cardProps} />
                </PreviewShell>
              </FitPreview>
            </section>
            {/*
              On phones, Current/Next stack full-width so the organic agent stays readable inside
              100vh. The 390px mobile sample is redundant there and is shown from sm up.
            */}
            <section aria-label={`${name} mobile card`} className="hidden sm:block">
              <SampleCaption>Mobile · {MOBILE_SAMPLE_WIDTH_PX}px</SampleCaption>
              <FitPreview width={MOBILE_SAMPLE_WIDTH_PX}>
                <PreviewShell>
                  <div
                    className="mx-auto rounded-2xl bg-background/30 px-inset-lg py-inset-md"
                    style={{ width: MOBILE_SAMPLE_WIDTH_PX }}
                  >
                    <Card {...cardProps} />
                  </div>
                </PreviewShell>
              </FitPreview>
            </section>
          </div>
        </section>
      ))}
    </div>
  );
}
