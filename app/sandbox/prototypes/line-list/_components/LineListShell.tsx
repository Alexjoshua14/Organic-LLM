"use client";

import Link from "next/link";
import { useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageSquare } from "lucide-react";

import type { Thread } from "@/lib/schemas/chat";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { NewChatInput } from "@/components/chat/new-chat-input";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/third-party/ai-elements/conversation";
import { WineLineListStatus } from "./WineLineListStatus";
import { WineLineListTable } from "./WineLineListTable";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

interface LineListShellProps {
  chatData: { thread: Thread; messages: UIMessage[] };
}

function hasWineLineListPart(message: UIMessage): boolean {
  return message.parts.some(
    (p) => p.type === "data-wineLineList" && (p as { data?: { wines?: unknown[] } }).data?.wines,
  );
}

function getUserText(message: UIMessage): string {
  return message.parts
    .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join("");
}

export function LineListShell({ chatData }: LineListShellProps) {
  const modelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(false);

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
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1];
        return {
          body: {
            message: lastMessage,
            id,
          },
        };
      },
    }),
  });

  const lastMessage = messages[messages.length - 1];
  const showGenerating =
    (status === "submitted" || status === "streaming") &&
    lastMessage?.role === "user";

  return (
    <div className="flex flex-col h-full max-h-[calc(100dvh-8rem)]">
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

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="w-full px-0 pt-4 pb-16 flex flex-col gap-6">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Start a line list"
                description="Type a wine name or query below"
              />
            ) : (
              <>
                {messages.map((message) => {
                  if (message.role === "user") {
                    const text = getUserText(message);
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          glass(),
                          "p-4 rounded-lg max-w-[80%] w-fit place-self-end text-sm text-foreground",
                        )}
                      >
                        {text}
                      </div>
                    );
                  }

                  if (message.role === "assistant" && hasWineLineListPart(message)) {
                    return (
                      <WineLineListTable
                        key={message.id}
                        message={message}
                        threadId={chatData.thread.id}
                      />
                    );
                  }

                  const text = getUserText(message);
                  if (!text) return null;

                  return (
                    <div
                      key={message.id}
                      className="rounded-lg p-4 bg-muted/50 text-foreground text-sm max-w-[80%]"
                    >
                      {text}
                    </div>
                  );
                })}
                {showGenerating && <WineLineListStatus />}
              </>
            )}
            <ConversationScrollButton className="bottom-16" />
          </ConversationContent>
        </Conversation>

        <div className="shrink-0 pt-4 pb-2">
          <NewChatInput
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
    </div>
  );
}

