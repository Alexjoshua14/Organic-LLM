"use client";

import type { ExaSearchResultSource } from "@/lib/exa/types";

import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { ChatThinking } from "@/components/chat/chat-loading";

import { Conversation, ConversationScrollButton } from "../third-party/ai-elements/conversation";
import { ChatThread } from "../chat/chat-thread";
import {
  ChatThreadTitleOverlay,
  useResolvedThreadTitle,
} from "../chat/chat-thread-title-overlay";
import { CoreInput } from "../chat/core-input";
import { NoesisScrollPersistence } from "./noesis-scroll-persistence";

import { isClientPIIRedactionEnabled, redactUIMessages } from "@/lib/pii/redact";
import { getSettings } from "@/lib/user-settings";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { ChatAIActionEnum } from "@/types/ai";
import { getChatErrorMessage } from "@/lib/chat/error-messages";
import {
  loadNoesisScrollSnapshot,
  noesisConversationInitial,
} from "@/lib/sandbox/noesis-scroll-storage";
import {
  DEFAULT_COMPOSER_MEMORIES,
  DEFAULT_COMPOSER_WEB_SEARCH,
} from "@/lib/chat/composer-tool-defaults";
import { FeatureHint } from "@/components/onboarding/feature-hint";
import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

const logger = createLogger("components/sandbox/topic-explore-client");

const ASSIST_COOLDOWN_MS = 1_500;

function textFromUiMessage(m: UIMessage): string {
  const parts = m.parts ?? [];

  return parts
    .filter(
      (p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string"
    )
    .map((p) => p.text)
    .join("");
}

function toAssistTurns(messages: UIMessage[]): { role: "user" | "assistant"; text: string }[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const t = textFromUiMessage(m).trim();

      return {
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        text: t,
      };
    })
    .filter((t) => t.text.length > 0)
    .slice(-24);
}

export type TopicExploreClientProps = {
  chatData: { thread: Thread; messages: UIMessage[] };
};

export function TopicExploreClient({ chatData }: TopicExploreClientProps) {
  const { refreshSidebarChats } = useSharedChatContext();
  const threadId = chatData.thread.id;
  const threadTitle = useResolvedThreadTitle(threadId, chatData.thread.title);
  const [conversationInitial] = useState(() =>
    noesisConversationInitial(loadNoesisScrollSnapshot(threadId))
  );
  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(DEFAULT_COMPOSER_WEB_SEARCH);
  const useMemoriesRef = useRef(DEFAULT_COMPOSER_MEMORIES);
  const useSpeechFriendlyRef = useRef(false);

  const [aiAction, setAiAction] = useState<
    | {
        action: ChatAIActionEnum;
        message?: string;
        sources?: ExaSearchResultSource[];
      }
    | undefined
  >(undefined);
  const [chatError, setChatError] = useState<unknown>(undefined);
  const [starters, setStarters] = useState<string[]>([]);
  const [startersLoading, setStartersLoading] = useState(false);
  const [thoughtProfile, setThoughtProfile] = useState("");
  const thoughtProfileRef = useRef("");
  const lastProfiledUserMessageIdRef = useRef<string | null>(null);

  const [steerOutput, setSteerOutput] = useState("");
  const [steerPending, setSteerPending] = useState(false);
  const [assistPending, setAssistPending] = useState(false);
  const [nextAssistAt, setNextAssistAt] = useState<number | null>(null);
  const [assistCooldownTick, setAssistCooldownTick] = useState(0);
  const [composerInject, setComposerInject] = useState<{ id: number; text: string } | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const composerDraftRef = useRef("");
  const injectNonce = useRef(0);
  const assistEligibleTurnRef = useRef<string | null>(null);

  useEffect(() => {
    thoughtProfileRef.current = thoughtProfile;
  }, [thoughtProfile]);

  useEffect(() => {
    composerDraftRef.current = composerDraft;
  }, [composerDraft]);

  useEffect(() => {
    if (nextAssistAt == null || Date.now() >= nextAssistAt) return;
    const id = window.setInterval(() => setAssistCooldownTick((n) => n + 1), 400);

    return () => window.clearInterval(id);
  }, [nextAssistAt]);

  const { messages, sendMessage, status, error, clearError } = useChat({
    id: chatData.thread.id,
    messages: chatData.messages,
    resume: true,
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
            model: selectedModelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
            messageSearch: true,
            knowledgeSearch: false,
            speechFriendly: useSpeechFriendlyRef.current,
            experience: "topic_explore",
            zeroDataRetention: getSettings().zeroDataRetention,
          },
        };
      },
    }),
    onData: (data) => {
      if (data.type === "data-notification") {
        const dataObject = data.data as { message?: string };

        if (dataObject.message === "chat-title-generated") {
          refreshSidebarChats();
        }
      } else if (data.type === "data-aiAction") {
        const dataObject = data.data as {
          action: ChatAIActionEnum;
          message?: string;
          sources?: ExaSearchResultSource[];
          query?: string;
        };

        switch (dataObject.action) {
          case ChatAIActionEnum.Reasoning:
            setAiAction({ action: ChatAIActionEnum.Reasoning, message: dataObject.message });
            break;
          case ChatAIActionEnum.Tool: {
            let toolName: string | undefined;

            if (dataObject.message) {
              toolName = dataObject.message.split(": ")[1];
            }
            if (toolName === "web_search") {
              setAiAction((prev) => {
                let sources: ExaSearchResultSource[] | undefined;

                if (prev && prev.action === ChatAIActionEnum.Search) {
                  sources = [...(prev.sources ?? []), ...(dataObject.sources ?? [])];
                  sources = sources.filter(
                    (source, index, self) => index === self.findIndex((t) => t.id === source.id)
                  );
                } else {
                  sources = dataObject.sources;
                }

                return {
                  action: ChatAIActionEnum.Search,
                  message: dataObject.message,
                  sources,
                };
              });
            } else if (toolName === "memory_search") {
              setAiAction({
                action: ChatAIActionEnum.Memory,
                message: dataObject.message,
              });
            } else {
              setAiAction({
                action: ChatAIActionEnum.Tool,
                message: dataObject.message,
              });
            }
            break;
          }
          case ChatAIActionEnum.Memory: {
            const q = dataObject.query?.trim();

            setAiAction({
              action: ChatAIActionEnum.Memory,
              message:
                q && q.length > 0
                  ? `Searching memories for "${q.length > 56 ? `${q.slice(0, 56)}…` : q}"`
                  : (dataObject.message ?? "Searching memories..."),
            });
            break;
          }
          default:
            setAiAction({
              action: dataObject.action,
              message: dataObject.message,
              sources: dataObject.sources,
            });
        }
      }
    },
    onError: (err) => {
      setAiAction({ action: ChatAIActionEnum.Errored, message: undefined });
      setChatError(err);
      toast.error(getChatErrorMessage(err));
      logger.error("useChat", getChatErrorMessage(err));
    },
    onFinish: () => {
      setAiAction(undefined);
      setNextAssistAt(null);
    },
  });

  const loadStarters = useCallback(async () => {
    setStartersLoading(true);

    try {
      const res = await fetch("/api/sandbox/topic-explore/starters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludeThreadId: chatData.thread.id }),
      });
      const data = (await res.json()) as { sparks?: string[] };

      setStarters(Array.isArray(data.sparks) ? data.sparks.slice(0, 4) : []);
    } catch {
      toast.error("Could not load starters");
    } finally {
      setStartersLoading(false);
    }
  }, [chatData.thread.id]);

  useEffect(() => {
    if (messages.length > 0) return;
    void loadStarters();
  }, [messages.length, loadStarters]);

  const messagesRef = useRef(messages);

  messagesRef.current = messages;

  const lastUserFingerprint = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const id = last?.id ?? "";
    const t = last ? textFromUiMessage(last).trim() : "";

    return `${id}:${t.length}`;
  }, [messages]);

  useEffect(() => {
    const last = [...messagesRef.current].reverse().find((m) => m.role === "user");

    if (!last) return;
    const id = last.id ?? "";

    if (!id || lastProfiledUserMessageIdRef.current === id) return;

    const userText = textFromUiMessage(last).trim();

    if (!userText) return;

    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/sandbox/topic-explore/thought-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previousProfile: thoughtProfileRef.current,
            newUserTexts: [userText],
          }),
        });

        if (!res.ok) return;
        const data = (await res.json()) as { profile?: string };

        if (typeof data.profile === "string") {
          lastProfiledUserMessageIdRef.current = id;
          setThoughtProfile(data.profile);
        }
      } catch {
        /* non-fatal */
      }
    }, 750);

    return () => window.clearTimeout(handle);
  }, [lastUserFingerprint]);

  const lastAssistantTurnKey = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");

    if (!last) return null;
    const text = textFromUiMessage(last).trim();

    return `${last.id ?? ""}:${text.length}`;
  }, [messages]);

  useEffect(() => {
    if (!lastAssistantTurnKey) return;
    if (assistEligibleTurnRef.current === lastAssistantTurnKey) return;
    assistEligibleTurnRef.current = lastAssistantTurnKey;
    setNextAssistAt(null);
  }, [lastAssistantTurnKey]);

  const handleStop = useCallback(async () => {
    logger.log("topic-explore", "stop disabled");
  }, []);

  const assistCooldownRemaining =
    nextAssistAt != null && Date.now() < nextAssistAt
      ? Math.max(0, Math.ceil((nextAssistAt - Date.now()) / 1000))
      : 0;

  void assistCooldownTick;

  const chatBusy = status === "submitted" || status === "streaming";
  const lastMessageIsAssistant = messages.at(-1)?.role === "assistant";
  const canSuggestReply =
    !assistPending &&
    !chatBusy &&
    status === "ready" &&
    messages.length > 0 &&
    lastMessageIsAssistant &&
    assistCooldownRemaining === 0;

  const assistDisabled = !canSuggestReply;

  const runAssist = useCallback(
    async (options?: { autoSend?: boolean }) => {
      if (!canSuggestReply) return;
      setAssistPending(true);

      const draft = composerDraftRef.current.trim();

      try {
        const res = await fetch("/api/sandbox/topic-explore/assist-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastTurns: toAssistTurns(messages),
            thoughtProfile: thoughtProfileRef.current,
            steerNotes: steerOutput.trim() || undefined,
            composerDraft: draft || undefined,
          }),
        });

        const data = (await res.json()) as { text?: string; error?: string };

        if (!res.ok || !data.text) {
          toast.error(data.error ?? "Assist failed");

          return;
        }

        if (options?.autoSend) {
          sendMessage({ text: data.text });
          injectNonce.current += 1;
          setComposerInject({ id: injectNonce.current, text: "" });
          setComposerDraft("");
        } else {
          injectNonce.current += 1;
          setComposerInject({ id: injectNonce.current, text: data.text });
        }
        setNextAssistAt(Date.now() + ASSIST_COOLDOWN_MS);
      } catch {
        toast.error("Assist failed");
      } finally {
        setAssistPending(false);
      }
    },
    [canSuggestReply, messages, sendMessage, steerOutput]
  );

  const runSteer = useCallback(
    async (instruction: string) => {
      setSteerPending(true);

      try {
        const res = await fetch("/api/sandbox/topic-explore/steer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction,
            lastTurns: toAssistTurns(messages),
          }),
        });
        const data = (await res.json()) as { text?: string; error?: string };

        if (!res.ok || typeof data.text !== "string") {
          toast.error(data.error ?? "Steer failed");

          return;
        }

        setSteerOutput(data.text);
      } catch {
        toast.error("Steer failed");
      } finally {
        setSteerPending(false);
      }
    },
    [messages]
  );

  const emptyState = useCallback(() => {
    return (
      <div className="flex flex-col gap-6 w-full max-w-xl mx-auto py-8 px-2">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-medium text-foreground">Noesis</h2>
          <p className="text-sm text-muted-foreground">
            Explore one thread of thought. Pick a spark or type below. Memory is on for context;
            this mode does not write new memories from the chat.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <FeatureHint id="noesis-sparks" showWhen={messages.length === 0}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Sparks
                </span>
                <Button
                  className="h-8 gap-1.5 text-xs"
                  disabled={startersLoading || messages.length > 0}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => void loadStarters()}
                >
                  {startersLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Regenerate
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(starters.length > 0 ? starters : ["", "", "", ""]).map((s, i) => (
                  <button
                    key={`spark-${i}`}
                    className={cn(
                      "cursor-pointer rounded-lg border border-border/60 bg-background-secondary/40 px-3 py-3 text-left text-sm",
                      "hover:border-accent/40 hover:bg-background-secondary/70 transition-colors",
                      "disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed",
                      !s && "min-h-[4.5rem] animate-pulse"
                    )}
                    disabled={!s || startersLoading || status !== "ready"}
                    type="button"
                    onClick={() => s && sendMessage({ text: s })}
                  >
                    {s || (startersLoading ? "…" : "—")}
                  </button>
                ))}
              </div>
            </div>
          </FeatureHint>
        </div>
      </div>
    );
  }, [loadStarters, messages.length, sendMessage, starters, startersLoading, status]);

  return (
    <div
      className={[
        "w-full",
        "min-w-0",
        "h-full",
        "sm:max-h-[calc(100dvh-2rem)]",
        "flex",
        "flex-col",
        "overflow-x-hidden",
      ].join(" ")}
    >
      <Conversation
        className={[
          "flex-1",
          "min-h-0",
          "w-full",
          "relative",
          "flex",
          "flex-col",
          "items-center",
          "overflow-x-hidden",
          "overscroll-x-none",
        ].join(" ")}
        initial={conversationInitial}
        resize={conversationInitial === false ? "instant" : "smooth"}
      >
        <ChatThreadTitleOverlay title={threadTitle} />
        <ChatThread aiActionPayload={aiAction} messages={messages} renderEmptyState={emptyState} />
        <NoesisScrollPersistence messageCount={messages.length} threadId={threadId} />
        <ConversationScrollButton className="bottom-14" />
      </Conversation>
      <div className="shrink-0 px-4 sm:px-7 pb-1 md:pb-4 w-full -mt-10 flex flex-col gap-2">
        <div className="sm:max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-24rem)] lg:max-w-4xl mx-auto w-full flex flex-col gap-2">
          {steerOutput.trim().length > 0 ? (
            <div
              className={cn(
                glass({ opaque: true }),
                "rounded-lg px-3 py-2 text-xs text-muted-foreground max-h-32 overflow-y-auto"
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="font-medium text-foreground/80">Steer notes (for assist)</div>
                <Button
                  aria-label="Dismiss steer notes"
                  className="size-7 shrink-0 -mr-1 -mt-0.5 text-muted-foreground"
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => setSteerOutput("")}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-[13px] text-foreground/90">
                {steerOutput}
              </pre>
            </div>
          ) : null}
          <div className="flex items-center gap-2 flex-wrap">
            <FeatureHint id="noesis-suggest-reply" showWhen={canSuggestReply}>
              <Button
                className={cn("gap-2", canSuggestReply ? "cursor-pointer" : "cursor-not-allowed")}
                disabled={assistDisabled}
                size="sm"
                title={
                  composerDraft.trim().length > 0
                    ? "Finish your draft in the composer (Shift+click to send without editing)"
                    : "Draft your next reply in the composer (Shift+click to send without editing)"
                }
                type="button"
                variant="glass"
                onClick={(event) => void runAssist({ autoSend: event.shiftKey })}
              >
                <Sparkles className="size-4 shrink-0" />
                {assistPending ? (
                  <ChatThinking
                    as="span"
                    className="text-sm font-normal"
                    text={
                      composerDraft.trim().length > 0 ? "Finish my reply" : "Suggest my reply"
                    }
                  />
                ) : composerDraft.trim().length > 0 ? (
                  "Finish my reply"
                ) : (
                  "Suggest my reply"
                )}
                {assistCooldownRemaining > 0 ? (
                  <span className="text-muted-foreground tabular-nums">
                    ({assistCooldownRemaining}s)
                  </span>
                ) : null}
              </Button>
            </FeatureHint>
            {!assistPending && composerDraft.trim().length > 0 ? (
              <span className="text-xs text-muted-foreground">Edit before you send</span>
            ) : null}
            {canSuggestReply && !assistPending ? (
              <button
                className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                type="button"
                onClick={() => void runAssist({ autoSend: true })}
              >
                Send suggestion
              </button>
            ) : null}
          </div>
          <CoreInput
            chatId={chatData.thread.id}
            clearError={clearError}
            composerInject={composerInject}
            error={error ?? chatError}
            featureHints={messages.length > 0}
            isBlankChat={messages.length === 0}
            modelRef={selectedModelRef}
            onComposerTextChange={setComposerDraft}
            secondarySubmitDisabled={steerPending || status !== "ready"}
            secondarySubmitLabel="Steer assist"
            secondarySubmitPending={steerPending}
            sendMessage={sendMessage}
            status={status}
            steerHintShowWhen={canSuggestReply}
            stop={handleStop}
            useMemoriesRef={useMemoriesRef}
            useSpeechFriendlyRef={useSpeechFriendlyRef}
            useWebSearchRef={useWebSearchRef}
            onErrorCleared={() => setChatError(undefined)}
            onSecondarySubmit={(t) => void runSteer(t)}
          />
        </div>
      </div>
    </div>
  );
}
