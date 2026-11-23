"use client";

import type { StageController } from "@/components/stage/stage";
import type { StageOperation, StageTurnSettings } from "@/lib/stage/schema";
import type {
  JevStageActionKind,
  JevStageBundle,
  JevStageStreamEvent,
  JevStageTraceEvent,
  JevStageTurnInsight,
} from "@/lib/jev-stage/schema";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { stageRequest, StageRequestError } from "@/components/stage/use-stage";
import { applyStageOperations, stageReservedRects } from "@/lib/stage/layout";
import { emptyStageState } from "@/lib/stage/schema";
import {
  JEV_STAGE_CLIENT_TIMEOUT_MS,
  JEV_STAGE_DESIGN_POLL_MS,
  JEV_STAGE_HEARTBEAT_MS,
  JEV_STAGE_MAX_TURN_INSIGHTS,
  JEV_STAGE_TURN_DEADLINE_MS,
} from "@/lib/jev-stage/constants";
import { emptyJevStageBundle } from "@/lib/jev-stage/schema";
import { shortModel } from "@/lib/jev-stage/trace-view";

const ACTION_LABEL: Record<JevStageActionKind, string> = {
  respond: "Respond",
  orchestrate: "Orchestrate",
  memory_search: "Memory search",
  web_search: "Web search",
  view_switch: "Switch view",
  captures: "File captures",
  recall: "Recall memories",
  designer_brief: "Brief designer",
  specialists: "Dispatch specialists",
};

async function readNdjson(
  response: Response,
  onEvent: (event: JevStageStreamEvent) => void
): Promise<void> {
  if (!response.body) throw new Error("No stream body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;
      onEvent(JSON.parse(trimmed) as JevStageStreamEvent);
    }
  }
  // The server terminates each event with a newline. A tail fragment is an interrupted stream.
}

export function useJevStage(): StageController & {
  insights: JevStageTurnInsight[];
  streamingText: string;
  submittedMessage: { id: string; text: string } | null;
  turnStatus: string;
  statusPulse: number;
  liveTrace: JevStageTraceEvent[];
  recovering: boolean;
  designerStatus: string | null;
  setEval: (turnId: string, signal: "up" | "down", note?: string | null) => Promise<void>;
} {
  const [bundle, setBundle] = useState<JevStageBundle>(emptyJevStageBundle);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<{ id: string; text: string } | null>(
    null
  );
  const [turnStatus, setTurnStatus] = useState("");
  const [statusPulse, setStatusPulse] = useState(0);
  const [liveTrace, setLiveTrace] = useState<JevStageTraceEvent[]>([]);
  const [quietTurn, setQuietTurn] = useState(false);
  const [recovery, setRecovery] = useState<{ id: string; until: number } | null>(null);
  const [designOffline, setDesignOffline] = useState(false);
  const designActive = bundle.stage.design?.status === "working";
  const designPhase = bundle.stage.design?.phase;
  const designerStatus = designActive
    ? designOffline
      ? "Reconnecting to the designer"
      : designPhase === "queued"
        ? "Waiting for the designer"
        : "Building your stage pieces"
    : null;
  const current = useRef(bundle);
  const sendLock = useRef(false);
  const mounted = useRef(true);

  current.current = bundle;

  const accept = useCallback((next: JevStageBundle) => {
    if (!mounted.current) return;
    current.current = next;
    setBundle(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await stageRequest<JevStageBundle>("/api/prototypes/jev-stage");

      accept(data);
      if (mounted.current) setError(null);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof StageRequestError && cause.status === 401
            ? "Sign in with lab access to open Jev Stage."
            : cause instanceof Error
              ? cause.message
              : "Couldn’t load Jev Stage."
        );
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (sending || (!designActive && !recovery)) return;
    let disposed = false;
    let timer: number | undefined;
    let polling = false;

    async function poll() {
      if (disposed || sendLock.current || polling) return;
      polling = true;

      try {
        const data = await stageRequest<JevStageBundle>("/api/prototypes/jev-stage", {
          signal: AbortSignal.timeout(JEV_STAGE_CLIENT_TIMEOUT_MS),
        });

        if (disposed || sendLock.current) return;
        setDesignOffline(false);
        if (
          data.stage.revision >= current.current.stage.revision ||
          data.stage.design?.id !== current.current.stage.design?.id ||
          data.stage.design?.status !== current.current.stage.design?.status ||
          data.stage.design?.phase !== current.current.stage.design?.phase
        )
          accept(data);
        if (recovery && data.insights.some((insight) => insight.turnId === recovery.id)) {
          setSubmittedMessage(null);
          setRecovery(null);
          setError(null);
        }
      } catch {
        if (!disposed) setDesignOffline(true);
      } finally {
        polling = false;
        if (!disposed) {
          if (recovery && Date.now() >= recovery.until) {
            setRecovery(null);
            setError(
              "The connection was interrupted and no completed turn was found. Try sending again."
            );
          }
          timer = window.setTimeout(poll, JEV_STAGE_DESIGN_POLL_MS);
        }
      }
    }

    void poll();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [accept, designActive, recovery, sending]);

  const send = useCallback(
    async (message: string, settings?: StageTurnSettings) => {
      if (sendLock.current) return false;
      sendLock.current = true;
      setSending(true);
      setError(null);
      setStreamingText("");
      const requestId = crypto.randomUUID();

      setSubmittedMessage({ id: requestId, text: message });
      setTurnStatus("Received");
      setLiveTrace([]);
      setRecovery(null);
      setQuietTurn(false);
      const abort = new AbortController();
      let timeout: number | undefined;
      let lastUpdate = performance.now();
      const recover = () =>
        setRecovery({
          id: requestId,
          until: Date.now() + JEV_STAGE_TURN_DEADLINE_MS,
        });
      const resetTimeout = () => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => abort.abort(), JEV_STAGE_CLIENT_TIMEOUT_MS);
      };

      resetTimeout();

      try {
        const response = await fetch("/api/prototypes/jev-stage", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, requestId, settings }),
          signal: abort.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);

          throw new StageRequestError(data?.error ?? "Turn failed", response.status);
        }

        let sawDone = false;
        let streamFailed = false;
        let writing: string | null = null;

        await readNdjson(response, (event) => {
          if (!mounted.current) return;
          resetTimeout();
          if (event.type === "heartbeat") {
            setQuietTurn(performance.now() - lastUpdate >= JEV_STAGE_HEARTBEAT_MS);

            return;
          }
          lastUpdate = performance.now();
          setQuietTurn(false);
          if (event.type === "delta") {
            setStreamingText((value) => value + event.text);
            if (writing) setTurnStatus(writing);
          } else if (event.type === "route") {
            const action = ACTION_LABEL[event.selected.kind];

            setTurnStatus(
              event.fellBack
                ? `Falling back to ${action}`
                : `Jev chose ${action} · ${event.selected.confidence.toFixed(2)}`
            );
          } else if (event.type === "step_boundary" && event.turnId === requestId) {
            setStatusPulse((pulse) => pulse + 1);
          } else if (event.type === "trace") {
            const trace = event.event;

            setLiveTrace((events) => [...events, trace]);

            switch (trace.kind) {
              case "jev.start":
                setTurnStatus("Jev is choosing a route");
                break;
              case "hop.start":
                if (trace.model) {
                  const model = shortModel(trace.model);

                  writing = `Writing with ${model}`;
                  setTurnStatus(
                    trace.operation === "orchestrate"
                      ? `Orchestrating with ${model}`
                      : `Preparing a reply with ${model}`
                  );
                }
                break;
              case "hop.first_token":
                setTurnStatus(writing ?? "Writing a reply");
                break;
              case "hop.tool": {
                const name = trace.tool.name.replaceAll("_", " ");
                const result = trace.tool.ok === false ? "failed" : trace.tool.result;

                setTurnStatus(result ? `${name} · ${result}` : name);
                break;
              }
              case "hop.end":
                if (trace.note && trace.ok) setTurnStatus(trace.note);
                break;
              case "fallback":
                setTurnStatus(
                  trace.to === "respond" ? "Falling back to Respond" : "Preparing a fallback reply"
                );
                break;
            }
          } else if (event.type === "patch" || event.type === "done") {
            if (event.type === "done") sawDone = true;
            accept({
              stage: event.stage,
              insights:
                event.type === "done"
                  ? [
                      ...current.current.insights.filter((i) => i.turnId !== event.insight.turnId),
                      event.insight,
                    ].slice(-JEV_STAGE_MAX_TURN_INSIGHTS)
                  : current.current.insights,
            });
          } else if (event.type === "limit_error" || event.type === "error") {
            streamFailed = true;
            setError(event.message);
          }
        });
        // Keep the last streamed text visible until Stage messages include the reply.
        setStreamingText("");
        if (sawDone && !streamFailed) {
          setSubmittedMessage(null);
        } else {
          if (!streamFailed) recover();
          setTurnStatus("Message could not be completed");
        }

        return !streamFailed;
      } catch (cause) {
        setStreamingText("");
        if (abort.signal.aborted || cause instanceof TypeError) {
          recover();

          return true;
        }
        setError(cause instanceof Error ? cause.message : "Your message couldn’t be sent.");
        setTurnStatus("Message could not be completed");

        return false;
      } finally {
        window.clearTimeout(timeout);
        sendLock.current = false;
        if (mounted.current) setSending(false);
      }
    },
    [accept]
  );

  const mutate = useCallback(
    async (operations: StageOperation[]) => {
      setSaving(true);
      try {
        const previous = current.current.stage;
        const nextStage = {
          ...previous,
          revision: previous.revision + 1,
          widgets: applyStageOperations(previous.widgets, operations, stageReservedRects(previous)),
        };
        const next = { ...current.current, stage: nextStage };

        accept(next);

        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That change couldn’t be saved.");

        return false;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [accept]
  );

  const reset = useCallback(async () => {
    try {
      const data = await stageRequest<JevStageBundle>("/api/prototypes/jev-stage", {
        method: "POST",
        body: JSON.stringify({ action: "reset" }),
      });

      accept(data);
      setError(null);
      setSubmittedMessage(null);
      setRecovery(null);

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t reset.");

      return false;
    }
  }, [accept]);

  const setEval = useCallback(
    async (turnId: string, signal: "up" | "down", note?: string | null) => {
      const data = await stageRequest<{ bundle: JevStageBundle }>(
        "/api/prototypes/jev-stage/eval",
        {
          method: "POST",
          body: JSON.stringify({ turnId, signal, note: note ?? null }),
        }
      );

      accept(data.bundle);
    },
    [accept]
  );

  const requestDesignChange = useCallback(
    async (action: "retry-design" | "cancel-design", jobId?: string) => {
      try {
        const data = await stageRequest<JevStageBundle>("/api/prototypes/jev-stage", {
          method: "POST",
          body: JSON.stringify({ action, ...(jobId ? { jobId } : {}) }),
        });

        accept(data);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not update the designer.");
      }
    },
    [accept]
  );
  const retryDesign = useCallback(() => requestDesignChange("retry-design"), [requestDesignChange]);
  const cancelSubagent = useCallback(
    async (id: string) => {
      if (id === current.current.stage.design?.id) await requestDesignChange("cancel-design", id);
    },
    [requestDesignChange]
  );

  return useMemo(
    () => ({
      state: bundle.stage ?? emptyStageState(),
      error,
      loading,
      sending: sending || !!recovery,
      saving,
      send,
      mutate,
      refresh: load,
      retryDesign,
      cancelSubagent,
      reset,
      insights: bundle.insights,
      streamingText,
      submittedMessage,
      turnStatus: recovery
        ? "Connection interrupted · checking for your reply"
        : quietTurn && sending
          ? `Still working · ${turnStatus}`
          : turnStatus,
      statusPulse,
      liveTrace,
      recovering: !!recovery,
      designerStatus,
      setEval,
    }),
    [
      bundle.stage,
      bundle.insights,
      error,
      loading,
      sending,
      saving,
      send,
      mutate,
      load,
      retryDesign,
      cancelSubagent,
      reset,
      streamingText,
      submittedMessage,
      turnStatus,
      statusPulse,
      liveTrace,
      recovery,
      designerStatus,
      quietTurn,
      setEval,
    ]
  );
}
