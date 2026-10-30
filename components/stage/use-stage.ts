"use client";

import type { StageOperation, StageState, StageTurnSettings } from "@/lib/stage/schema";

import { useCallback, useEffect, useRef, useState } from "react";

import { stageSubagentActive } from "@/lib/stage/schema";

const DESIGN_POLL_MS = 1_500;

export async function stageRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Sign in to open your stage."
        : (data?.error ?? "Your stage couldn’t be reached. Try again.")
    );
  }

  return data as T;
}

export function useStage({ voiceActive = false }: { voiceActive?: boolean } = {}) {
  const [state, setState] = useState<StageState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = useRef<StageState | null>(null);
  const sendLock = useRef(false);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  const retryTurn = useRef<{ message: string; requestId: string } | null>(null);

  const accept = useCallback((next: StageState) => {
    if (!mounted.current || (current.current && next.revision < current.current.revision)) return;
    current.current = next;
    setState(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await stageRequest<{ state: StageState }>("/api/stage");

      accept(data.state);
      if (mounted.current) setError(null);
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : "Couldn’t load your stage.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const focus = () => void refresh();

    window.addEventListener("focus", focus);

    return () => {
      mounted.current = false;
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);

  const subagentKey =
    state?.subagents
      ?.filter(stageSubagentActive)
      .map((agent) => `${agent.id}:${agent.status}`)
      .join(",") ?? "";

  useEffect(() => {
    if (
      state?.design?.status !== "working" &&
      state?.design?.status !== "canceling" &&
      !subagentKey &&
      !voiceActive
    )
      return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState !== "hidden") await refresh();
      if (!disposed) timer = setTimeout(poll, DESIGN_POLL_MS);
    };

    timer = setTimeout(poll, DESIGN_POLL_MS);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [state?.design?.id, state?.design?.status, subagentKey, voiceActive, refresh]);

  const send = useCallback(
    async (message: string, settings?: StageTurnSettings) => {
      if (sendLock.current || !current.current) return false;
      sendLock.current = true;
      setSending(true);
      setError(null);
      const turn =
        retryTurn.current?.message === message
          ? retryTurn.current
          : { message, requestId: crypto.randomUUID() };

      retryTurn.current = turn;
      try {
        const data = await stageRequest<{ state: StageState }>("/api/stage", {
          method: "POST",
          body: JSON.stringify({ ...turn, settings }),
        });

        accept(data.state);
        retryTurn.current = null;

        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Your message couldn’t be sent.");

        return false;
      } finally {
        sendLock.current = false;
        if (mounted.current) setSending(false);
      }
    },
    [accept]
  );

  const mutate = useCallback(
    async (operations: StageOperation[]) => {
      if (saveLock.current || !current.current) return false;
      saveLock.current = true;
      setSaving(true);
      setError(null);
      try {
        const data = await stageRequest<{ state: StageState }>("/api/stage", {
          method: "PATCH",
          body: JSON.stringify({ revision: current.current.revision, operations }),
        });

        accept(data.state);

        return true;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "That change couldn’t be saved.";

        await refresh();
        setError(message);

        return false;
      } finally {
        saveLock.current = false;
        if (mounted.current) setSaving(false);
      }
    },
    [accept, refresh]
  );

  const retryDesign = useCallback(async () => {
    try {
      const data = await stageRequest<{ state: StageState }>("/api/stage", {
        method: "POST",
        body: JSON.stringify({ action: "retry-design", requestId: crypto.randomUUID() }),
      });

      accept(data.state);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t restart the designer.");
    }
  }, [accept]);

  const cancelSubagent = useCallback(
    async (id: string) => {
      try {
        const data = await stageRequest<{ state: StageState }>(`/api/stage/subagents/${id}`, {
          method: "DELETE",
        });

        accept(data.state);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn’t stop the specialist.");
      }
    },
    [accept]
  );

  return {
    state,
    error,
    loading,
    sending,
    saving,
    send,
    mutate,
    refresh,
    retryDesign,
    cancelSubagent,
  };
}
