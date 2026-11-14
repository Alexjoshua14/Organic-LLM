"use client";

import type { StageController } from "./stage";
import type { StageOperation, StageState } from "@/lib/stage/schema";

import { useCallback, useMemo, useRef, useState } from "react";

import { stageRequest } from "./use-stage";

import { applyStageOperations, stageReservedRects } from "@/lib/stage/layout";
import { emptyStageState } from "@/lib/stage/schema";
import { stageDemoScene, stageDemoState } from "@/lib/stage/demo/scenes";

/**
 * A StageController that plays prebuilt scenes instead of calling the Stage API. The real
 * `StageView` renders it, so the demo keeps the real chrome, layout engine and editing; only the
 * source of state differs. Piece edits and arrangement changes apply locally, as they do live.
 */
export function useStageDemo(): StageController & { scene: string; show: (id: string) => void } {
  const [state, setState] = useState<StageState>(() => emptyStageState());
  const [scene, setScene] = useState("blank");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef({ state, scene });

  current.current = { state, scene };

  const play = useCallback((id: string, text?: string) => {
    const next = stageDemoScene(id);

    if (!next) return;
    setScene(id);
    setState((previous) => stageDemoState(previous, next, text));
  }, []);

  const send = useCallback(
    async (message: string) => {
      setSending(true);
      setError(null);
      try {
        const { scene: chosen } = await stageRequest<{ scene: string }>("/api/stage/demo", {
          method: "POST",
          body: JSON.stringify({ message, current: current.current.scene }),
        });

        play(chosen, message);

        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The demo couldn’t pick a scene.");

        return false;
      } finally {
        setSending(false);
      }
    },
    [play]
  );

  const mutate = useCallback(async (operations: StageOperation[]) => {
    const previous = current.current.state;

    try {
      // Applied outside the state updater so a rejected layout reports instead of crashing render.
      const next = {
        ...previous,
        revision: previous.revision + 1,
        widgets: applyStageOperations(previous.widgets, operations, stageReservedRects(previous)),
      };

      current.current.state = next;
      setState(next);

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change couldn’t be saved.");

      return false;
    }
  }, []);

  const noop = useCallback(async () => undefined, []);

  return useMemo(
    () => ({
      state,
      error,
      loading: false,
      sending,
      saving: false,
      send,
      mutate,
      refresh: noop,
      retryDesign: noop,
      cancelSubagent: noop,
      scene,
      show: (id: string) => play(id),
    }),
    [state, error, sending, send, mutate, noop, scene, play]
  );
}
