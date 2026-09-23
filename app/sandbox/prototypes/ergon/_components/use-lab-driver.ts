"use client";

import type { KanbanActivity } from "@/components/chat/kanban/living/living-light";
import type { KanbanBoardState } from "@/lib/kanban/store";
import type { KanbanCommand } from "@/lib/schemas/kanban";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LAB_FIRST_STEP_DELAY_MS,
  LAB_IN_FLIGHT_MS,
  LAB_INITIATE_IN_FLIGHT_MS,
  LAB_LOOP_HOLD_MS,
  LAB_STEP_MS,
} from "@/components/chat/kanban/living/living-board-timing";
import { IDLE_ACTIVITY } from "@/components/chat/kanban/living/living-light";
import { kanbanCommandTargets } from "@/lib/kanban/board-lanes";
import { reduceBoard } from "@/lib/kanban/store";

export type LabDriver = {
  board: KanbanBoardState | undefined;
  /** Commands applied so far. */
  applied: number;
  total: number;
  activity: KanbanActivity;
  playing: boolean;
  play: () => void;
  pause: () => void;
  /** Send the next command now (it still goes through its in-flight beat). */
  step: () => void;
  restart: () => void;
};

function inFlightMs(command: KanbanCommand | undefined): number {
  return command?.type === "INITIATE_KANBAN" ? LAB_INITIATE_IN_FLIGHT_MS : LAB_IN_FLIGHT_MS;
}

/**
 * Plays a command script against a local board: each command is in flight (the model is mid
 * tool call) before it lands, then the board dwells so motion can settle. Loops.
 */
export function useLabDriver(commands: readonly KanbanCommand[]): LabDriver {
  const reduceMotion = useReducedMotion() ?? false;
  const [applied, setApplied] = useState(0);
  const [inFlight, setInFlight] = useState(false);
  const [playing, setPlaying] = useState(false);
  const total = commands.length;

  const snapshots = useMemo(() => {
    const boards: (KanbanBoardState | undefined)[] = [undefined];

    for (const command of commands) boards.push(reduceBoard(boards[boards.length - 1], command));

    return boards;
  }, [commands]);

  // Reduced motion: no autoplay; stepping still works.
  useEffect(() => {
    setPlaying(!reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    let delay: number;
    let advance: () => void;

    if (inFlight) {
      // An in-flight command always lands, even while paused.
      delay = inFlightMs(commands[applied]);
      advance = () => {
        setApplied((count) => Math.min(count + 1, total));
        setInFlight(false);
      };
    } else if (!playing) {
      return;
    } else if (applied >= total) {
      delay = LAB_LOOP_HOLD_MS;
      advance = () => setApplied(0);
    } else {
      delay = applied === 0 ? LAB_FIRST_STEP_DELAY_MS : LAB_STEP_MS;
      advance = () => setInFlight(true);
    }

    const timer = window.setTimeout(advance, delay);

    return () => window.clearTimeout(timer);
  }, [applied, inFlight, playing]);

  const activity = useMemo<KanbanActivity>(() => {
    const command = commands[applied];

    if (!inFlight || !command) return IDLE_ACTIVITY;

    return { phase: "working", command, targetId: kanbanCommandTargets(command)[0] };
  }, [applied, commands, inFlight]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  const step = useCallback(() => {
    if (inFlight) return;
    if (applied >= total) {
      setApplied(0);

      return;
    }
    setInFlight(true);
  }, [applied, inFlight, total]);

  const restart = useCallback(() => {
    setApplied(0);
    setInFlight(false);
    setPlaying(!reduceMotion);
  }, [reduceMotion]);

  return {
    board: snapshots[applied],
    applied,
    total,
    activity,
    playing,
    play,
    pause,
    step,
    restart,
  };
}
