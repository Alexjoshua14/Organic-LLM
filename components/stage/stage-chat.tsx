"use client";

import type { UIMessage } from "ai";
import type { Thread } from "@/lib/schemas/chat";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatMessage } from "@/components/chat/chat-message";
import { getChatErrorMessage } from "@/lib/chat/error-messages";
import { isClientPIIRedactionEnabled, redactUIMessages } from "@/lib/pii/redact";
import { models } from "@/lib/schemas/chat";
import { getSettings } from "@/lib/user-settings";

import styles from "./stage-chat.module.css";

type ChatData = { thread: Thread; messages: UIMessage[] };
type StageChatProps = { widgetId: string; threadId: string };

function getLoadError(status: number): string {
  if (status === 401) return "Sign in to open this conversation.";
  if (status === 403 || status === 404) return "This conversation is unavailable.";
  return "Could not load this conversation.";
}

/** One independently persisted conversation for one stage widget. */
export function StageChat({ widgetId, threadId }: StageChatProps) {
  const [data, setData] = useState<ChatData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setData(null);
      setLoadError(null);

      try {
        const response = await fetch(`/api/stage/chat?widgetId=${encodeURIComponent(widgetId)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(getLoadError(response.status));

        const body = (await response.json()) as { chatData?: ChatData };
        const chatData = body.chatData;

        if (!chatData?.thread?.id || !Array.isArray(chatData.messages)) {
          throw new Error("This conversation could not be opened.");
        }
        if (chatData.thread.id !== threadId) {
          throw new Error("This conversation changed. Refresh the stage to continue.");
        }

        if (!controller.signal.aborted) setData(chatData);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load this conversation."
          );
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [widgetId, threadId, attempt]);

  if (!data) {
    return (
      <div className={styles.state} role="status">
        {!loadError ? <span aria-hidden="true" className={styles.spinner} /> : null}
        <span>{loadError ?? "Opening conversation…"}</span>
        {loadError ? (
          <button
            className={styles.retry}
            onClick={() => setAttempt((value) => value + 1)}
            type="button"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <LoadedStageChat
      key={data.thread.id}
      data={data}
      onReload={() => setAttempt((value) => value + 1)}
    />
  );
}

function LoadedStageChat({ data, onReload }: { data: ChatData; onReload: () => void }) {
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [resumeCheck, setResumeCheck] = useState({ threadId: data.thread.id, pending: true });
  const pendingSendRef = useRef(false);
  const submittedDraftRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);

  const [transport] = useState<ChatTransport<UIMessage>>(() => {
    const base = new DefaultChatTransport<UIMessage>({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1];
        const message = isClientPIIRedactionEnabled()
          ? redactUIMessages([lastMessage])[0]
          : lastMessage;
        const settings = getSettings();

        return {
          body: {
            message,
            id,
            model: models.openai.luna,
            webSearch: false,
            memory: false,
            messageSearch: false,
            knowledgeSearch: false,
            zeroDataRetention: settings.zeroDataRetention,
            coalescenceMode: settings.coalescenceMode,
          },
        };
      },
    });

    return {
      sendMessages: (options) => base.sendMessages(options),
      reconnectToStream: async (options) => {
        const check = { threadId: options.chatId, pending: true };

        setResumeCheck(check);
        try {
          return await base.reconnectToStream(options);
        } finally {
          setResumeCheck((current) =>
            current === check ? { threadId: options.chatId, pending: false } : current
          );
        }
      },
    };
  });

  const { id, messages, sendMessage, status, error, clearError } = useChat({
    id: data.thread.id,
    messages: data.messages,
    resume: true,
    transport,
    onError: (sendFailure) => {
      setSendError(getChatErrorMessage(sendFailure));
      if (submittedDraftRef.current) {
        const failedDraft = submittedDraftRef.current;

        setDraft((current) => current || failedDraft);
      }
      submittedDraftRef.current = null;
    },
    onFinish: () => {
      submittedDraftRef.current = null;
      setSendError(null);
    },
  });

  const checkingResume = resumeCheck.threadId !== id || resumeCheck.pending;
  const busy = checkingResume || status === "submitted" || status === "streaming";
  const sendStateRef = useRef({ busy, id });

  sendStateRef.current = { busy, id };

  const submit = useCallback(async () => {
    const text = draft.trim();

    if (!text || sendStateRef.current.busy || pendingSendRef.current) return;

    pendingSendRef.current = true;
    submittedDraftRef.current = text;
    setDraft("");
    setSendError(null);
    clearError();

    try {
      await sendMessage({ text });
    } catch (sendFailure) {
      setSendError(getChatErrorMessage(sendFailure));
      setDraft(text);
      submittedDraftRef.current = null;
    } finally {
      pendingSendRef.current = false;
    }
  }, [draft, sendMessage, clearError]);

  useEffect(() => {
    const list = listRef.current;

    if (list && followingRef.current) list.scrollTop = list.scrollHeight;
  }, [messages, status]);

  return (
    <div className={styles.root}>
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named scroll region needs keyboard focus for native scrolling (MDN CSS overflow accessibility). */}
      <div
        aria-label="Conversation"
        className={styles.messages}
        ref={listRef}
        role="log"
        tabIndex={0}
        onScroll={(event) => {
          const list = event.currentTarget;

          followingRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
        }}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
        {messages.length === 0 ? (
          <p className={styles.empty}>Start a conversation.</p>
        ) : (
          messages.map((message) => (
            <div className={styles.message} data-role={message.role} key={message.id}>
              <span className={styles.role}>{message.role === "user" ? "You" : "Organic"}</span>
              <ChatMessage chatId={id} message={message} showActions={false} />
            </div>
          ))
        )}
        {checkingResume ? (
          <p className={styles.progress} role="status">
            <span aria-hidden="true" className={styles.spinner} /> Checking for a reply…
          </p>
        ) : busy ? (
          <p className={styles.progress} role="status">
            <span aria-hidden="true" className={styles.spinner} /> Organic is responding…
          </p>
        ) : null}
      </div>
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className={styles.visuallyHidden} htmlFor={`stage-chat-${id}`}>
          Message Organic
        </label>
        <textarea
          className={styles.input}
          id={`stage-chat-${id}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={checkingResume ? "Checking conversation…" : "Message Organic…"}
          rows={2}
          value={draft}
        />
        <button className={styles.send} disabled={busy || !draft.trim()} type="submit">
          Send
        </button>
      </form>
      {sendError || error ? (
        <div className={styles.error} role="alert">
          <span>{sendError ?? getChatErrorMessage(error)}</span>
          <button
            disabled={busy}
            onClick={() => (draft.trim() ? void submit() : onReload())}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
