"use client";

import type { DrawerChatDisplayInput } from "@/lib/rabbit-holes/drawer-chat-ui-budget";
import type {
  RabbitHolePlanBudgetSummary,
  RabbitHoleSubagentMeshItem,
  RabbitHoleSubagentStatus,
} from "@/components/rabbit-holes/RabbitHoleSubagentMeshBar";
import type { LlmProcessingIntensitySnapshot } from "@/lib/usage/processing-intensity";

import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolOrDynamicToolName, isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  SUBAGENT_BOARD_POLL_ACTIVE_MS,
  SUBAGENT_BOARD_POLL_IDLE_MS,
} from "@/lib/arcadia/multitask/board-sync";
import { inlineSubagentDispatch } from "@/lib/arcadia/multitask/inline-dispatches";
import { resolveSubagentIdentity } from "@/lib/arcadia/multitask/subagent-identity";
import { isClientPIIRedactionEnabled, redactUIMessages } from "@/lib/pii/redact";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { getSettings } from "@/lib/user-settings";
import {
  computeLlmProcessingIntensity,
  deriveSessionTelemetryCounts,
} from "@/lib/usage/processing-intensity";
import { ChatAIActionEnum } from "@/types/ai";

type SessionChatThreadPayload = { threadId: string; messages: UIMessage[] };

/**
 * One in-flight bootstrap per session. The rabbit-hole page mounts several chat composers at
 * once; each used to request the thread separately, and concurrent requests created duplicate
 * threads. The server now resolves that race too — this just stops asking twice.
 */
const pendingThreadRequests = new Map<string, Promise<SessionChatThreadPayload>>();

function fetchSessionChatThread(sessionId: string): Promise<SessionChatThreadPayload> {
  const pending = pendingThreadRequests.get(sessionId);

  if (pending) return pending;

  const request = fetch(`/api/rabbitholes/${sessionId}/chat-thread`)
    .then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };

        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      return res.json() as Promise<SessionChatThreadPayload>;
    })
    .finally(() => pendingThreadRequests.delete(sessionId));

  pendingThreadRequests.set(sessionId, request);

  return request;
}

export type UseRabbitHoleSessionChatOptions = {
  sessionId: string | null;
  drawerDisplayRef?: React.RefObject<DrawerChatDisplayInput | null>;
  onNavigate?: (activeNodeId: string) => void;
};

function normalizeSubagentStatus(raw: unknown): RabbitHoleSubagentStatus {
  if (
    raw === "idle" ||
    raw === "queued" ||
    raw === "working" ||
    raw === "blocked" ||
    raw === "done" ||
    raw === "complete"
  ) {
    return raw;
  }

  return "idle";
}

function parsePolledSubagents(payload: unknown): RabbitHoleSubagentMeshItem[] {
  if (!payload || typeof payload !== "object") return [];
  const rawList = Array.isArray((payload as { subagents?: unknown }).subagents)
    ? ((payload as { subagents: unknown[] }).subagents ?? [])
    : Array.isArray(payload)
      ? (payload as unknown[])
      : [];

  return rawList.flatMap((item): RabbitHoleSubagentMeshItem[] => {
    if (!item || typeof item !== "object") return [];
    const rec = item as Record<string, unknown>;
    const agentId =
      typeof rec.agentId === "string"
        ? rec.agentId
        : typeof rec.id === "string"
          ? rec.id
          : undefined;
    const fallbackIdentity = agentId ? resolveSubagentIdentity(agentId) : null;
    const name =
      typeof rec.name === "string" && rec.name.trim()
        ? rec.name.trim()
        : (fallbackIdentity?.name ?? "Subagent");
    const role =
      typeof rec.role === "string" && rec.role.trim() ? rec.role.trim() : fallbackIdentity?.role;

    return [
      {
        id: typeof rec.id === "string" ? rec.id : agentId,
        agentId,
        threadId: typeof rec.threadId === "string" ? rec.threadId : null,
        name,
        role,
        status: normalizeSubagentStatus(rec.status),
        statusAt: typeof rec.statusAt === "string" ? rec.statusAt : null,
        goal: typeof rec.goal === "string" ? rec.goal : null,
        brief: typeof rec.brief === "string" ? rec.brief : null,
        outcome: typeof rec.outcome === "string" ? rec.outcome : null,
        progress: typeof rec.progress === "string" ? rec.progress : null,
        response: typeof rec.response === "string" ? rec.response : null,
        latestResponse: typeof rec.latestResponse === "string" ? rec.latestResponse : null,
        modelId: typeof rec.modelId === "string" ? rec.modelId : null,
      },
    ];
  });
}

function parseUsagePlanBudget(payload: unknown): RabbitHolePlanBudgetSummary | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const rawPlan =
    root.plan && typeof root.plan === "object" ? (root.plan as Record<string, unknown>) : root;

  const spentRaw =
    typeof rawPlan.spentUsd === "number"
      ? rawPlan.spentUsd
      : typeof rawPlan.usedUsd === "number"
        ? rawPlan.usedUsd
        : undefined;
  const limitRaw =
    typeof rawPlan.limitUsd === "number" || rawPlan.limitUsd === null
      ? (rawPlan.limitUsd as number | null)
      : typeof rawPlan.capUsd === "number" || rawPlan.capUsd === null
        ? (rawPlan.capUsd as number | null)
        : undefined;

  if (
    spentRaw === undefined &&
    limitRaw === undefined &&
    typeof rawPlan.canDispatch !== "boolean"
  ) {
    return null;
  }

  const spentUsd = typeof spentRaw === "number" && Number.isFinite(spentRaw) ? spentRaw : 0;
  const limitUsd = typeof limitRaw === "number" && Number.isFinite(limitRaw) ? limitRaw : null;
  const remainingUsd =
    typeof rawPlan.remainingUsd === "number" && Number.isFinite(rawPlan.remainingUsd)
      ? rawPlan.remainingUsd
      : limitUsd !== null
        ? Math.max(0, limitUsd - spentUsd)
        : null;
  const canDispatch =
    typeof rawPlan.canDispatch === "boolean"
      ? rawPlan.canDispatch
      : limitUsd === null || spentUsd < limitUsd;

  return {
    spentUsd,
    usedUsd: spentUsd,
    limitUsd,
    capUsd: limitUsd,
    remainingUsd,
    canDispatch,
    plan: typeof rawPlan.plan === "string" ? rawPlan.plan : undefined,
  };
}

function countSubagentToolSignals(messages: ReadonlyArray<UIMessage>): number {
  let count = 0;

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!isToolUIPart(part)) continue;
      const toolName = getToolOrDynamicToolName(part);

      if (toolName === "dispatch_subagent" || toolName === "worktable") {
        count += 1;
      }
    }
  }

  return count;
}

function collectCompletedRabbitHoleToolCallIds(messages: ReadonlyArray<UIMessage>): Set<string> {
  const seen = new Set<string>();

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts ?? []) {
      if (!isToolUIPart(part)) continue;
      if (part.state !== "output-available") continue;
      const toolName = getToolOrDynamicToolName(part);

      if (toolName !== "generate_rabbit_hole_node" && toolName !== "navigate_rabbit_hole_node") {
        continue;
      }

      if (part.toolCallId) {
        seen.add(part.toolCallId);
      }
    }
  }

  return seen;
}

export function useRabbitHoleSessionChat({
  sessionId,
  drawerDisplayRef,
  onNavigate,
}: UseRabbitHoleSessionChatOptions) {
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const onNavigateRef = useRef(onNavigate);

  onNavigateRef.current = onNavigate;
  const handledToolNavCallIdsRef = useRef<Set<string>>(new Set());
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<
    { action: ChatAIActionEnum; message?: string } | undefined
  >(undefined);
  const [polledSubagents, setPolledSubagents] = useState<RabbitHoleSubagentMeshItem[]>([]);
  const [planBudget, setPlanBudget] = useState<RabbitHolePlanBudgetSummary | null>(null);
  const [usageRefreshTick, setUsageRefreshTick] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setThreadId(null);
      setInitialMessages([]);
      setPolledSubagents([]);
      handledToolNavCallIdsRef.current = new Set();

      return;
    }

    let cancelled = false;

    setBootstrapping(true);
    setBootError(null);

    fetchSessionChatThread(sessionId)
      .then((data) => {
        if (cancelled) return;

        const loadedMessages = data.messages ?? [];

        handledToolNavCallIdsRef.current = collectCompletedRabbitHoleToolCallIds(loadedMessages);
        setThreadId(data.threadId);
        setInitialMessages(loadedMessages);
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        setBootError(err instanceof Error ? err.message : "Failed to load chat thread");
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const chat = useChat({
    id: threadId ?? undefined,
    messages: initialMessages,
    resume: Boolean(threadId),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1];
        const message = isClientPIIRedactionEnabled()
          ? redactUIMessages([lastMessage])[0]
          : lastMessage;

        return {
          body: {
            message,
            id,
            model: modelRef.current,
            webSearch: false,
            memory: true,
            messageSearch: false,
            experience: "rabbit_hole",
            rabbitHoleSessionId: sessionId,
            drawerDisplay: drawerDisplayRef?.current ?? undefined,
            zeroDataRetention: getSettings().zeroDataRetention,
          },
        };
      },
    }),
    onData: (data) => {
      if (data.type === "data-rabbit-hole-nav") {
        const payload = data.data as { activeNodeId?: string };

        if (payload.activeNodeId) {
          onNavigate?.(payload.activeNodeId);
        }
      } else if (data.type === "data-aiAction") {
        const payload = data.data as { action: ChatAIActionEnum; message?: string };

        setAiAction({ action: payload.action, message: payload.message });
      }
    },
    onFinish: () => {
      setUsageRefreshTick((tick) => tick + 1);
    },
  });

  const isStreaming = chat.status === "streaming" || chat.status === "submitted" || bootstrapping;

  // Ensure generate_rabbit_hole_node / navigate_rabbit_hole_node output-available parts trigger
  // session reload & navigation even if a transient stream event was missed.
  useEffect(() => {
    for (const message of chat.messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts ?? []) {
        if (!isToolUIPart(part)) continue;
        if (part.state !== "output-available") continue;
        const toolName = getToolOrDynamicToolName(part);

        if (toolName !== "generate_rabbit_hole_node" && toolName !== "navigate_rabbit_hole_node") {
          continue;
        }

        const toolCallId = part.toolCallId;

        if (!toolCallId || handledToolNavCallIdsRef.current.has(toolCallId)) {
          continue;
        }

        const output = part.output as
          | { ok?: boolean; nodeId?: string; activeNodeId?: string }
          | undefined;
        const targetNodeId = output?.nodeId ?? output?.activeNodeId;

        if (output?.ok !== false && typeof targetNodeId === "string" && targetNodeId.length > 0) {
          handledToolNavCallIdsRef.current.add(toolCallId);
          onNavigateRef.current?.(targetNodeId);
        }
      }
    }
  }, [chat.messages]);

  // Fetch weekly usage budget snapshot once per session mount and after turns complete.
  useEffect(() => {
    if (typeof globalThis.fetch !== "function") return;
    let cancelled = false;

    fetch("/api/usage?range=7d", { cache: "no-store" })
      .then(async (res) => {
        if (!res?.ok) return null;

        return res.json().catch(() => null);
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        const parsed = parseUsagePlanBudget(payload);

        if (parsed) setPlanBudget(parsed);
      })
      .catch(() => {
        /* Gracefully ignore offline/unauthenticated/test environments */
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, usageRefreshTick]);

  const subagentToolSignalCount = useMemo(
    () => countSubagentToolSignals(chat.messages),
    [chat.messages]
  );

  const subagentsRef = useRef(polledSubagents);

  subagentsRef.current = polledSubagents;

  // Poll `/api/chats/${threadId}/subagents` when threadId is available and refresh on tool signals.
  useEffect(() => {
    if (!threadId || typeof globalThis.fetch !== "function") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pull = async () => {
      if (cancelled) return;
      try {
        let res = await fetch(`/api/chats/${encodeURIComponent(threadId)}/subagents`, {
          cache: "no-store",
        });

        if (res?.status === 404) {
          res = await fetch(`/api/chat/${encodeURIComponent(threadId)}/arcadia/subagents`, {
            cache: "no-store",
          });
        }

        if (res?.ok && !cancelled) {
          const payload = await res.json().catch(() => null);

          if (!cancelled && payload) {
            const next = parsePolledSubagents(payload);

            subagentsRef.current = next;
            setPolledSubagents(next);
          }
        }
      } catch {
        /* Ignore offline/mocked fetch errors */
      } finally {
        if (!cancelled) {
          const hasActive = subagentsRef.current.some(
            (w) => w.status === "working" || w.status === "queued"
          );

          timer = setTimeout(
            () => void pull(),
            hasActive ? SUBAGENT_BOARD_POLL_ACTIVE_MS : SUBAGENT_BOARD_POLL_IDLE_MS
          );
        }
      }
    };

    void pull();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [threadId, subagentToolSignalCount, usageRefreshTick]);

  // Merge polled subagent threads with any inline dispatch_subagent tool parts in messages.
  const subagents = useMemo<RabbitHoleSubagentMeshItem[]>(() => {
    const byId = new Map<string, RabbitHoleSubagentMeshItem>();

    for (const item of polledSubagents) {
      const key = item.agentId ?? item.id ?? item.name;

      byId.set(key, item);
    }

    for (const message of chat.messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts ?? []) {
        const dispatch = inlineSubagentDispatch(part);

        if (!dispatch) continue;
        const existing = byId.get(dispatch.agentId);

        if (!existing) {
          const identity = resolveSubagentIdentity(dispatch.agentId);

          byId.set(dispatch.agentId, {
            id: dispatch.agentId,
            agentId: dispatch.agentId,
            threadId: dispatch.threadId ?? null,
            name: dispatch.name || identity.name,
            role: identity.role,
            status: "working",
            goal: dispatch.brief,
            brief: dispatch.brief,
            modelId: dispatch.modelId ?? null,
          });
        } else if (!existing.brief && dispatch.brief) {
          byId.set(dispatch.agentId, {
            ...existing,
            brief: dispatch.brief,
            goal: existing.goal ?? dispatch.brief,
          });
        }
      }
    }

    return [...byId.values()];
  }, [polledSubagents, chat.messages]);

  const zeroDataRetention = useMemo(() => {
    try {
      return Boolean(getSettings().zeroDataRetention);
    } catch {
      return false;
    }
  }, [chat.messages.length, isStreaming]);

  const processingIntensity = useMemo<LlmProcessingIntensitySnapshot>(() => {
    const counts = deriveSessionTelemetryCounts({
      messages: chat.messages,
      subagents,
    });

    return computeLlmProcessingIntensity({
      isStreaming,
      activeSubagentCount: counts.activeSubagentCount,
      completedSubagentCount: counts.completedSubagentCount,
      toolCallCount: counts.toolCallCount,
      estimatedTokensUsed: counts.estimatedTokensUsed,
      planSpentUsd: planBudget?.spentUsd ?? planBudget?.usedUsd,
      planLimitUsd: planBudget?.limitUsd !== undefined ? planBudget.limitUsd : planBudget?.capUsd,
      zeroDataRetention,
    });
  }, [chat.messages, subagents, isStreaming, planBudget, zeroDataRetention]);

  const stop = useCallback(async () => {
    await chat.stop();
  }, [chat]);

  return {
    ...chat,
    threadId,
    bootstrapping,
    bootError,
    aiAction,
    isStreaming,
    subagents,
    processingIntensity,
    planBudget,
    zeroDataRetention,
    modelRef,
    stop,
  };
}
