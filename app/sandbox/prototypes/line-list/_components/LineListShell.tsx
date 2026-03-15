"use client";

import Link from "next/link";
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageSquare, ChevronDownIcon, ChevronRightIcon, Bug } from "lucide-react";

import type { Thread } from "@/lib/schemas/chat";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import type { WineEntry } from "@/lib/schemas/wine-line-list";
import {
  getWinesFromMessage,
  buildWineListMessage,
} from "@/lib/schemas/wine-line-list";
import { CoreInput } from "@/components/chat/core-input";
import { WineLineListStatus } from "./WineLineListStatus";
import { WineLineListTable } from "./WineLineListTable";
import { updateWineListMessage } from "../actions";

interface LineListShellProps {
  chatData: { thread: Thread; messages: UIMessage[] };
}

function hasWineLineListPart(message: UIMessage): boolean {
  return message.parts.some(
    (p) => p.type === "data-wineLineList" && (p as { data?: { wines?: unknown[] } }).data?.wines,
  );
}

export function LineListShell({ chatData }: LineListShellProps) {
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);
  const lastMergedListMessageIdRef = useRef<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
  } = useChat({
    id: chatData.thread.id,
    messages: chatData.messages,
    resume: true,
    transport: new DefaultChatTransport({
      api: "/api/prototypes/wine-line-list",
      prepareSendMessagesRequest({ messages: msgs, id }) {
        const lastMessage = msgs[msgs.length - 1];
        return {
          body: {
            message: lastMessage,
            id,
          },
        };
      },
    }),
  });

  const listMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && hasWineLineListPart(m)) return m;
    }
    return null;
  }, [messages]);

  const [wines, setWines] = useState<WineEntry[]>(() =>
    listMessage
      ? getWinesFromMessage(
        listMessage.parts as Array<{ type: string; data?: { wines?: WineEntry[] } }>,
      )
      : [],
  );

  useEffect(() => {
    if (!listMessage) {
      setWines([]);
      lastMergedListMessageIdRef.current = null;
      return;
    }
    const incoming = getWinesFromMessage(
      listMessage.parts as Array<{ type: string; data?: { wines?: WineEntry[] } }>,
    );
    if (listMessage.id === lastMergedListMessageIdRef.current) return;

    const prevId = lastMergedListMessageIdRef.current;
    const isNewMessage = prevId !== listMessage.id;

    if (isNewMessage && incoming.length === 0) {
      return;
    }

    if (isNewMessage && incoming.length > 0) {
      lastMergedListMessageIdRef.current = listMessage.id;
      if (prevId !== null) {
        setWines((prev) => {
          const merged = [...prev, ...incoming];
          const fullMessage = buildWineListMessage(listMessage.id, merged);
          updateWineListMessage(chatData.thread.id, listMessage.id, fullMessage).catch((err) => {
            console.error("Failed to persist merged wine list:", err);
          });
          return merged;
        });
      } else {
        setWines(incoming);
      }
    }
  }, [listMessage, chatData.thread.id]);

  const [debugOpen, setDebugOpen] = useState(false);

  const lastMessage = messages[messages.length - 1];
  const showGenerating =
    (status === "submitted" || status === "streaming") &&
    lastMessage?.role === "user";

  const handleWinesChange = useCallback(
    (nextWines: WineEntry[]) => {
      setWines(nextWines);
      if (listMessage?.id) {
        const fullMessage = buildWineListMessage(listMessage.id, nextWines);
        updateWineListMessage(chatData.thread.id, listMessage.id, fullMessage).catch((err) => {
          console.error("Failed to save wine list:", err);
        });
      }
    },
    [listMessage?.id, chatData.thread.id],
  );

  return (
    <div className="relative flex h-full max-h-[calc(100dvh-2rem)] flex-col overflow-hidden pb-42 sm:pt-10">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_1fr_2.5rem] gap-0">
        <nav className="mb-4">
          <Link
            href="/sandbox/prototypes"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Prototypes
          </Link>
        </nav>

        <header className="mb-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Wine line list
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell me a wine; I&apos;ll respond with a line list of style and key food affinities. Edit,
            reorder, and sort the rows below.
          </p>
        </header>

        <section
          className="min-h-0 overflow-auto"
          aria-label="Wine list"
        >
          {wines.length === 0 && !showGenerating ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
              <MessageSquare className="size-12 text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium text-foreground">Start a line list</p>
              <p className="text-sm text-muted-foreground mt-1">Type a wine name or query below</p>
            </div>
          ) : (
            <div className="p-4">
              <WineLineListTable
                wines={wines}
                threadId={chatData.thread.id}
                listMessageId={listMessage?.id ?? null}
                onWinesChange={handleWinesChange}
              />
            </div>
          )}
        </section>

        <div className="flex items-center px-1" aria-live="polite">
          {showGenerating && <WineLineListStatus />}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <CoreInput
            modelRef={modelRef}
            useWebSearchRef={useWebSearchRef}
            useMemoriesRef={useMemoriesRef}
            sendMessage={sendMessage}
            stop={stop}
            status={status}
            error={error}
            clearError={clearError}
            chatId={chatData.thread.id}
            isBlankChat={messages.length === 0}
          />
        </div>
      </div>

      <div
        className="fixed right-0 top-1/3 z-10 flex h-full max-h-[calc(40dvh-2rem)]"
        aria-label="Debug panel"
      >
        {debugOpen ? (
          <div className="flex w-80 flex-col border-l border-border bg-card shadow-lg">
            <button
              type="button"
              onClick={() => setDebugOpen(false)}
              className="flex shrink-0 items-center gap-2 border-b border-border p-2 text-left text-xs text-muted-foreground hover:text-foreground"
              aria-expanded="true"
            >
              <ChevronRightIcon className="size-3.5 rotate-180" />
              <Bug className="size-3.5" />
              <span>Debug</span>
            </button>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(
                  {
                    winesRendered: wines,
                    winesCount: wines.length,
                    wineIds: wines.map((w) => w.id),
                    listMessageId: listMessage?.id ?? null,
                    messagesCount: messages.length,
                    lastMergedListMessageIdRef: lastMergedListMessageIdRef.current,
                    listMessageParts:
                      listMessage?.parts.map((p) =>
                        p.type === "data-wineLineList"
                          ? { type: p.type, winesCount: (p as { data?: { wines?: unknown[] } }).data?.wines?.length }
                          : { type: p.type },
                      ) ?? null,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDebugOpen(true)}
            className="flex h-24 w-8 flex-col items-center justify-center gap-1 rounded-l border border-r-0 border-border bg-muted/80 py-2 text-muted-foreground shadow hover:bg-muted hover:text-foreground"
            aria-expanded="false"
            title="Open debug panel"
          >
            <Bug className="size-3.5" />
            <span className="text-[10px] font-medium tracking-tight">Debug</span>
          </button>
        )}
      </div>
    </div>
  );
}

