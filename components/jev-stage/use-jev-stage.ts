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
  clear_pieces: "Clear pieces",
  designer_brief: "Brief designer",
  specialists: "Dispatch specialists",
};

const CORRECTION_LABEL = {
  queued: "Correction received · waiting for the next model step",
  delivered: "Correction delivered",
  undelivered: "Correction wasn’t delivered",
  unconfirmed: "Correction delivery couldn’t be confirmed",
} as const;

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
  working: boolean;
  correctionStatus: string | null;
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
  const [active, setActive] = useState(0);
  const [correctionStatus, setCorrectionStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<{ id: string; text: string } | null>(
    null
  );
  const [turnStatus, setTurnStatus] = useState("");
  const [statusPulse, setStatusPulse] = useState(0);
  const [liveTrace, setLiveTrace] = useState<JevStageTraceEvent[]>([]);
  const [quietTurn, setQuietTurn] = useState(false);
  const [recovery, setRecovery] = useState<Record<string, number>>({});
  const recovering = Object.keys(recovery).length > 0;
  const [designOffline, setDesignOffline] = useState(false);
  const designActive = bundle.stage.design?.status === "working";
  const specialistActive = bundle.stage.subagents?.some((job) =>
    job.status === "queued" || job.status === "working" || job.status === "canceling"
  );
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
  const latestRequest = useRef<string | null>(null);
  const resetRevision = useRef(-1);
  const localLayoutRevision = useRef<number | null>(null);

  const accept = useCallback((next: JevStageBundle, localLayout = false) => {
    if (!mounted.current || next.stage.revision < current.current.stage.revision) return;

    if (localLayout) {
      localLayoutRevision.current = next.stage.revision;
    } else if (localLayoutRevision.current === next.stage.revision) {
      next = { ...next, stage: current.current.stage };
    } else {
      localLayoutRevision.current = null;
    }

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
    if (!designActive && !specialistActive && !recovering) return;
    let disposed = false;
    let timer: number | undefined;
    let polling = false;

    async function poll() {
      if (disposed || polling) return;
      polling = true;

      try {
        const data = await stageRequest<JevStageBundle>("/api/prototypes/jev-stage", {
          signal: AbortSignal.timeout(JEV_STAGE_CLIENT_TIMEOUT_MS),
        });

        if (disposed) return;
        setDesignOffline(false);
        accept(data);
        for (const id of Object.keys(recovery)) {
          const recovered = data.insights.find((insight) => insight.turnId === id);

          if (!recovered) continue;
          setRecovery((pending) => {
            const next = { ...pending };

            delete next[id];
            return next;
          });
          if (latestRequest.current === id) {
            setSubmittedMessage(null);
            if (recovered.correction) setCorrectionStatus(CORRECTION_LABEL[recovered.correction.status]);
            setError(null);
          }
        }
      } catch {
        if (!disposed) setDesignOffline(true);
      } finally {
        polling = false;
        if (!disposed) {
          for (const [id, until] of Object.entries(recovery)) {
            if (Date.now() < until) continue;
            setRecovery((pending) => {
              const next = { ...pending };

              delete next[id];
              return next;
            });
            if (latestRequest.current === id) {
              setError("The connection was interrupted and no completed turn was found.");
            }
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
  }, [accept, designActive, specialistActive, recovery, recovering]);

  const send = useCallback(
    async (message: string, settings?: StageTurnSettings) => {
      if (sendLock.current) return false;
      sendLock.current = true;
      setSending(true);
      setError(null);
      setStreamingText("");
      const requestId = crypto.randomUUID();
      const isLatest = () => mounted.current && latestRequest.current === requestId;
      latestRequest.current = requestId;
      setActive((count) => count + 1);
      setCorrectionStatus(null);

      setSubmittedMessage({ id: requestId, text: message });
      setTurnStatus("Received");
      setLiveTrace([]);
      setQuietTurn(false);
      const abort = new AbortController();
      let timeout: number | undefined;
      let lastUpdate = performance.now();
      const recover = () =>
        setRecovery((pending) => ({
          ...pending,
          [requestId]: Date.now() + JEV_STAGE_TURN_DEADLINE_MS,
        }));
      let admitted = false;
      let resolveSend: (accepted: boolean) => void;
      const submitted = new Promise<boolean>((resolve) => { resolveSend = resolve; });
      const releaseComposer = (accepted: boolean) => {
        if (admitted) return;
        admitted = true;
        sendLock.current = false;
        if (mounted.current) setSending(false);
        resolveSend(accepted);
      };
      const resetTimeout = () => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => abort.abort(), JEV_STAGE_CLIENT_TIMEOUT_MS);
      };

      resetTimeout();

      void (async () => {
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
            if (event.type === "accepted") {
              releaseComposer(true);
              return;
            }
            if (event.type === "done") {
              sawDone = true;
              releaseComposer(true);
              if (event.stage.revision <= resetRevision.current) return;
              const currentBundle = current.current;
              if (
                event.stage.revision < currentBundle.stage.revision &&
                currentBundle.insights.some((item) => item.turnId === event.insight.turnId)
              ) return;
              const insights = [
                ...currentBundle.insights.filter((item) => item.turnId !== event.insight.turnId),
                event.insight,
              ].sort((a, b) => a.at.localeCompare(b.at)).slice(-JEV_STAGE_MAX_TURN_INSIGHTS);

              accept({
                stage: event.stage.revision >= currentBundle.stage.revision
                  ? event.stage
                  : currentBundle.stage,
                insights,
              });
            }
            if (event.type === "limit_error" || event.type === "error") streamFailed = true;
            if (!isLatest()) return;
            if (event.type === "correction") {
              const label = CORRECTION_LABEL[event.correction.status];

              setCorrectionStatus(label);
              setTurnStatus(label);
              return;
            }
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
            } else if (event.type === "limit_error" || event.type === "error") {
              setError(event.message);
            }
          });
          if (!sawDone && !streamFailed) recover();
          if (isLatest()) {
            setStreamingText("");
            if (sawDone && !streamFailed) setSubmittedMessage(null);
            else setTurnStatus("Message could not be completed");
          }
          releaseComposer(!streamFailed);
        } catch (cause) {
          if (isLatest()) setStreamingText("");
          if (abort.signal.aborted || cause instanceof TypeError) {
            recover();
            releaseComposer(true);
          } else {
            if (isLatest()) {
              setError(cause instanceof Error ? cause.message : "Your message couldn’t be sent.");
              setTurnStatus("Message could not be completed");
            }
            releaseComposer(false);
          }
        } finally {
          window.clearTimeout(timeout);
          if (mounted.current) setActive((count) => count - 1);
        }
      })();

      return submitted;
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
          widgets: applyStageOperations(previous.widgets, operations, stageReservedRects(previous)),
        };
        const next = { ...current.current, stage: nextStage };

        accept(next, true);

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

      resetRevision.current = data.stage.revision;
      latestRequest.current = null;
      accept(data);
      setError(null);
      setSubmittedMessage(null);
      setRecovery({});
      setCorrectionStatus(null);

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
    async (action: "retry-design" | "cancel-design" | "cancel-specialist", jobId?: string) => {
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
      await requestDesignChange(
        id === current.current.stage.design?.id ? "cancel-design" : "cancel-specialist", id
      );
    },
    [requestDesignChange]
  );

  return useMemo(
    () => ({
      state: bundle.stage ?? emptyStageState(),
      error,
      loading,
      sending,
      working: active > 0 || recovering,
      correctionStatus,
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
      turnStatus: submittedMessage && recovery[submittedMessage.id]
        ? "Connection interrupted · checking for your reply"
        : quietTurn && active > 0
          ? `Still working · ${turnStatus}`
          : turnStatus,
      statusPulse,
      liveTrace,
      recovering,
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
      recovering,
      active,
      correctionStatus,
      designerStatus,
      quietTurn,
      setEval,
    ]
  );
}
