"use client";

import type { LivingLight } from "./living-light";
import type { ReactNode, Ref } from "react";

import { useInView } from "framer-motion";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { KanbanCompact } from "./KanbanCompact";
import { LivingBoard } from "./LivingBoard";
import { describeKanbanCommand, LIVING_LIGHTS } from "./living-light";
import { useLabDriver } from "./use-lab-driver";

import { KanbanView } from "@/components/chat/kanban/KanbanView";
import { glass } from "@/components/design-system/primitives";
import { applyKanbanCommand, resetKanbanBoard } from "@/lib/kanban/store";
import {
  ERGON_FULL_BOARD_VIEW,
  ERGON_NEXT_UP_VIEW,
  ergonShowcaseCommands,
  ergonShowcaseSession,
} from "@/lib/showcase/ergon-session";
import { cn } from "@/lib/utils";

/** Thread for the production board shown as the "before". */
const BEFORE_THREAD_ID = "sandbox-ergon";

type LabWidth = "chat" | "panel" | "wide";

const WIDTHS: { value: LabWidth; label: string; maxWidth?: number }[] = [
  { value: "chat", label: "Chat · 640", maxWidth: 640 },
  { value: "panel", label: "Panel · 760", maxWidth: 760 },
  { value: "wide", label: "Wide" },
];

function assistantLine(chapterIndex: number, which: "first" | "last"): string {
  const texts = (ergonShowcaseSession.chapters[chapterIndex]?.assistant ?? []).flatMap((step) =>
    step.kind === "text" ? [step.text] : []
  );

  return (which === "first" ? texts[0] : texts[texts.length - 1]) ?? "";
}

const PLAN_REPLY = assistantLine(0, "last");
const NEXT_REPLY = assistantLine(2, "first");

/** Sections within this distance of the viewport count as on screen. */
const ON_SCREEN_MARGIN = "240px 0px";

/**
 * Offscreen sections hold their last frame, so only what is on screen renders and animates;
 * a section scrolled back into view catches up to the live value.
 */
function useHeldOffscreen<T>(value: T, onScreen: boolean): T {
  const [held, setHeld] = useState(value);

  if (onScreen && held !== value) setHeld(value);

  return onScreen ? value : held;
}

export function ErgonBoardLab() {
  const driver = useLabDriver(ergonShowcaseCommands);
  const [light, setLight] = useState<LivingLight>("trace");
  const [compare, setCompare] = useState(false);
  const [width, setWidth] = useState<LabWidth>("panel");
  const maxWidth = WIDTHS.find((option) => option.value === width)?.maxWidth;
  const appliedRef = useRef(0);
  const boardSectionRef = useRef<HTMLElement>(null);
  const threadSectionRef = useRef<HTMLElement>(null);
  const beforeSectionRef = useRef<HTMLElement>(null);
  const boardOnScreen = useInView(boardSectionRef, { margin: ON_SCREEN_MARGIN });
  const threadOnScreen = useInView(threadSectionRef, { margin: ON_SCREEN_MARGIN });
  const beforeOnScreen = useInView(beforeSectionRef, { margin: ON_SCREEN_MARGIN });
  const boardFrame = useHeldOffscreen(driver.board, boardOnScreen);
  const boardActivity = useHeldOffscreen(driver.activity, boardOnScreen);
  const threadFrame = useHeldOffscreen(driver.board, threadOnScreen);
  const threadActivity = useHeldOffscreen(driver.activity, threadOnScreen);

  // The production board replays the same script from the shared thread store.
  useEffect(() => {
    resetKanbanBoard(BEFORE_THREAD_ID);

    return () => resetKanbanBoard(BEFORE_THREAD_ID);
  }, []);

  useEffect(() => {
    if (!beforeOnScreen) return;
    if (driver.applied < appliedRef.current) {
      resetKanbanBoard(BEFORE_THREAD_ID);
      appliedRef.current = 0;
    }
    for (let i = appliedRef.current; i < driver.applied; i++) {
      applyKanbanCommand(BEFORE_THREAD_ID, ergonShowcaseCommands[i]!);
    }
    appliedRef.current = driver.applied;
  }, [driver.applied, beforeOnScreen]);

  const inFlight = driver.activity.phase === "working" ? driver.activity.command : undefined;
  const lastApplied = driver.applied > 0 ? ergonShowcaseCommands[driver.applied - 1] : undefined;
  const status = inFlight
    ? `In flight: ${describeKanbanCommand(inFlight, driver.board)}`
    : lastApplied
      ? `Landed: ${describeKanbanCommand(lastApplied, driver.board)}`
      : "Waiting for the model to open a board";
  const shown = compare ? LIVING_LIGHTS : LIVING_LIGHTS.filter((option) => option.id === light);

  return (
    <div className="space-y-10">
      <div
        className={cn(
          glass({ opaque: true }),
          "sticky top-3 z-30 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border/50 px-3 py-2.5"
        )}
      >
        <Segmented
          label="Light"
          options={LIVING_LIGHTS.map((option) => ({ value: option.id, label: option.label }))}
          value={compare ? undefined : light}
          onChange={(value) => {
            setLight(value);
            setCompare(false);
          }}
        />
        <button
          aria-pressed={compare}
          className={cn(
            "rounded-md px-2 py-1 text-2xs font-medium transition-colors",
            compare
              ? "bg-foreground text-background"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          )}
          type="button"
          onClick={() => setCompare((value) => !value)}
        >
          Compare all
        </button>
        <Segmented label="Width" options={WIDTHS} value={width} onChange={setWidth} />
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <p
            aria-live="polite"
            className="mr-2 min-w-0 max-w-[22rem] truncate text-2xs text-muted-foreground"
          >
            <span className="font-mono text-foreground/70">
              {driver.applied}/{driver.total}
            </span>{" "}
            {status}
          </p>
          <TransportButton
            label={driver.playing ? "Pause" : "Play"}
            onClick={driver.playing ? driver.pause : driver.play}
          >
            {driver.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </TransportButton>
          <TransportButton label="Send next command" onClick={driver.step}>
            <SkipForward className="size-3.5" />
          </TransportButton>
          <TransportButton label="Restart" onClick={driver.restart}>
            <RotateCcw className="size-3.5" />
          </TransportButton>
        </div>
      </div>

      <LabSection
        ref={boardSectionRef}
        hint="The full board, replaying the showcase script. Hover a card with notes to peek at them."
        title="Board"
      >
        <div className="space-y-8">
          {shown.map((option) => (
            <figure key={option.id} className="space-y-2.5">
              <figcaption className="max-w-2xl space-y-0.5">
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{option.blurb}</p>
              </figcaption>
              <div style={{ maxWidth }}>
                <LivingBoard
                  followChanges
                  activity={boardActivity}
                  board={boardFrame}
                  light={option.id}
                  view={ERGON_FULL_BOARD_VIEW}
                />
              </div>
            </figure>
          ))}
        </div>
      </LabSection>

      <LabSection
        ref={threadSectionRef}
        hint="How a summoned view sits inside an assistant message: the board at a glance, the cards the answer is about, and a way into the full board."
        title="In the thread"
      >
        <div className="max-w-[40rem] space-y-6">
          <ThreadTurn text={PLAN_REPLY}>
            <KanbanCompact
              activity={threadActivity}
              board={threadFrame}
              boardView={ERGON_FULL_BOARD_VIEW}
              light={compare ? "trace" : light}
              view={ERGON_FULL_BOARD_VIEW}
            />
          </ThreadTurn>
          <ThreadTurn text={NEXT_REPLY}>
            <KanbanCompact
              activity={threadActivity}
              board={threadFrame}
              boardView={ERGON_FULL_BOARD_VIEW}
              light={compare ? "trace" : light}
              view={ERGON_NEXT_UP_VIEW}
            />
          </ThreadTurn>
        </div>
      </LabSection>

      <LabSection
        ref={beforeSectionRef}
        hint="The production board today, on the same script."
        title="Before"
      >
        <BeforeBoard maxWidth={maxWidth} />
      </LabSection>
    </div>
  );
}

/** The production board follows the thread store on its own; lab ticks leave it alone. */
const BeforeBoard = memo(function BeforeBoard({ maxWidth }: { maxWidth?: number }) {
  return (
    <div style={{ maxWidth }}>
      <KanbanView threadId={BEFORE_THREAD_ID} view={ERGON_FULL_BOARD_VIEW} />
    </div>
  );
});

function LabSection({
  title,
  hint,
  children,
  ref,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}) {
  return (
    <section ref={ref} className="space-y-4">
      <div>
        <h2 className="text-2xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function ThreadTurn({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <div
        aria-label={label}
        className="flex gap-0.5 rounded-md bg-muted/50 p-0.5"
        role="radiogroup"
      >
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              aria-checked={active}
              className={cn(
                "rounded px-2 py-1 text-2xs font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              role="radio"
              type="button"
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TransportButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
