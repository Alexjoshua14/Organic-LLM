"use client";

import type {
  AgentDotState,
  ActivityGlassByState,
} from "@/components/agents/organic-activity-mark";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { ACTIVITY_GLASS_BY_STATE } from "@/components/agents/activity-mark-glass";
import { AGENT_DOTS, dotOpacity, dotRestScale } from "@/components/agents/agent-dot-grid-motion";

// Deliberately unequal holds let the three identities move independently through a shared story.
const CYCLE: {
  duration: number;
  states: [AgentDotState, AgentDotState, AgentDotState];
  caption: string;
}[] = [
  {
    duration: 4200,
    states: ["working", "idle", "idle"],
    caption: "The orchestrator shapes the assignment.",
  },
  {
    duration: 6800,
    states: ["waiting", "working", "working"],
    caption: "Two specialists work at their own pace.",
  },
  {
    duration: 3600,
    states: ["waiting", "blocked", "working"],
    caption: "Reed needs a decision. Lyra keeps investigating.",
  },
  {
    duration: 4700,
    states: ["working", "waiting", "complete"],
    caption: "One result comes back while another task waits.",
  },
  {
    duration: 6100,
    states: ["idle", "working", "idle"],
    caption: "The main conversation stays available.",
  },
  {
    duration: 3100,
    states: ["working", "complete", "idle"],
    caption: "Reed finishes. The orchestrator brings the work together.",
  },
  {
    duration: 4400,
    states: ["complete", "idle", "idle"],
    caption: "A center-out completion pulse, then rest.",
  },
];
const STATES: AgentDotState[] = ["idle", "working", "waiting", "blocked", "complete"];
const CLEAR_COVER: ActivityGlassByState = Object.fromEntries(
  STATES.map((state) => [state, { opacity: 0, blur: 0, brightness: 1, tint: "transparent" }])
);
const AGENTS = [
  { name: "Orchestrator", role: "Main conversation", seed: "showcase-main" },
  { name: "Reed", role: "Implementation", seed: "showcase-reed" },
  { name: "Lyra", role: "Research", seed: "showcase-lyra" },
];

/** The existing mark's image layer provides a truly static resting pattern when motion is paused. */
function restingImage(seed: string) {
  const circles = AGENT_DOTS.map(({ x, y }, index) => {
    const scale = dotRestScale(index, seed);

    return `<circle cx="${x}" cy="${y}" r="${2 * scale}" opacity="${dotOpacity(scale)}"/>`;
  }).join("");

  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="#555b5e">${circles}</svg>`)}`;
}
const RESTING_IMAGES = AGENTS.map((agent) => restingImage(agent.seed));

export function AgentMaterialStudy() {
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState<AgentDotState | null>(null);
  const [clear, setClear] = useState(false);
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const frame = CYCLE[phase]!;
  const states = manual ? [manual, manual, manual] : frame.states;
  const material = ACTIVITY_GLASS_BY_STATE[states[0]!];

  useEffect(() => {
    const element = ref.current;

    if (!element) return;
    let inView = typeof IntersectionObserver === "undefined";
    const sync = () => setActive(inView && !document.hidden);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              inView = entry?.isIntersecting === true;
              sync();
            },
            { threshold: 0.15 }
          );

    observer?.observe(element);
    sync();
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  useEffect(() => {
    if (!active || paused || manual || reduceMotion) return;
    const timer = window.setTimeout(
      () => setPhase((current) => (current + 1) % CYCLE.length),
      frame.duration
    );

    return () => window.clearTimeout(timer);
  }, [active, paused, manual, reduceMotion, frame.duration, phase]);

  return (
    <div className="ma-instrument ma-material-study" ref={ref}>
      <div className="ma-instrument-bar">
        <span>ORGANIC AGENT / MATERIAL STUDY</span>
        <span>
          {reduceMotion ? "Reduced motion respected" : "Production components · scripted states"}
        </span>
      </div>
      <div className="ma-material-grid">
        <div className="ma-agent-stage" data-paused={paused || !!reduceMotion}>
          <div className="ma-agent-wiring" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          {AGENTS.map((agent, index) => (
            <div className={`ma-agent ma-agent-${index}`} key={agent.seed}>
              <OrganicActivityMark
                className="ma-live-mark"
                seed={agent.seed}
                state={states[index]}
                glassByState={clear ? CLEAR_COVER : undefined}
                glassDistortion={!clear}
                imageUrl={paused ? RESTING_IMAGES[index] : undefined}
              />
              <strong>{agent.name}</strong>
              <span>{agent.role}</span>
              <span className="ma-agent-state" data-state={states[index]}>
                <i />
                {states[index]}
              </span>
            </div>
          ))}
          <p className="ma-stage-caption">
            {paused
              ? "Motion paused. Resting patterns shown."
              : manual
                ? `Inspecting the ${manual} state.`
                : frame.caption}
          </p>
        </div>
        <div className="ma-material-controls">
          <span className="ma-mono">A VISUAL LANGUAGE FOR WORK</span>
          <h3>State, made tangible.</h3>
          <p>Each mark has its own pattern. The dots and the material respond together.</p>
          <fieldset className="ma-state-picker">
            <legend>Inspect a state</legend>
            {STATES.map((state) => (
              <button
                type="button"
                key={state}
                aria-pressed={manual === state}
                onClick={() => {
                  setManual(state);
                  setPaused(false);
                }}
              >
                {state}
              </button>
            ))}
          </fieldset>
          <button
            className="ma-cover-toggle"
            type="button"
            aria-pressed={clear}
            onClick={() => setClear((value) => !value)}
          >
            <span>{clear ? "Clear cover" : "Crafted glass"}</span>
            <span aria-hidden>{clear ? "○" : "◉"}</span>
          </button>
          <dl className="ma-material-values">
            <div>
              <dt>Cover blur</dt>
              <dd>{clear ? "0" : material.blur} px</dd>
            </div>
            <div>
              <dt>Material alpha</dt>
              <dd>{clear ? "0" : material.opacity}</dd>
            </div>
            <div>
              <dt>Brightness</dt>
              <dd>{clear ? "1" : material.brightness}×</dd>
            </div>
          </dl>
          <p className="ma-caption">
            {clear
              ? "Cover diffusion and refraction removed to expose the dot structure. The grain and individual dot surfaces remain."
              : "Orchestrator material targets shown. Each specialist follows its own state’s preset."}
          </p>
          <div className="ma-playback">
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              disabled={!!reduceMotion}
            >
              {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
              {paused ? "Play motion" : "Pause motion"}
            </button>
            <button
              type="button"
              onClick={() => {
                setManual(null);
                setPhase(0);
                setPaused(false);
              }}
            >
              <RotateCcw size={14} aria-hidden />
              Auto-cycle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
