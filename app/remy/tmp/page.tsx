"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Page from "@/components/layout/page";
import { ChatThread } from "@/components/chat/chat-thread";
import { NewChatInput } from "@/components/chat/new-chat-input";
import { Conversation, ConversationScrollButton } from "@/components/third-party/ai-elements/conversation";
import { ChatModel, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import {
  isClientPIIRedactionEnabled,
  redactUIMessages,
} from "@/lib/pii/redact";
import { createLogger } from "@/lib/logger";
import {
  getTmpChat,
  saveTmpChat,
  RemyTmpChat,
  cleanupExpiredTmpChats,
} from "@/data/local/remy-chats";
import { nanoid } from "nanoid";
import { useCallback } from "react";

const logger = createLogger("app/remy/tmp/page.tsx");

function RemyTmpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("initialMessage");
  const initialMessageSent = useRef(false);
  const chatIdRef = useRef<string>(nanoid());
  const [tmpChat, setTmpChat] = useState<RemyTmpChat | null>(null);
  const tmpChatRef = useRef<RemyTmpChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selectedModelRef = useRef<ChatModel>(DEFAULT_CHAT_MODEL);
  const useWebSearchRef = useRef<boolean>(false);
  const useMemoriesRef = useRef<boolean>(false);

  // Load tmp chat from localStorage and cleanup expired chats
  useEffect(() => {
    const loadTmpChat = async () => {
      try {
        // Cleanup expired chats on load
        await cleanupExpiredTmpChats();

        const result = await getTmpChat();
        if (result.data) {
          setTmpChat(result.data);
          tmpChatRef.current = result.data;
          chatIdRef.current = result.data.id;
        } else {
          // Create new tmp chat
          const newChat: RemyTmpChat = {
            id: chatIdRef.current,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            saved: false,
          };
          setTmpChat(newChat);
          tmpChatRef.current = newChat;
          await saveTmpChat(newChat);
        }
      } catch (err) {
        logger.error("loadTmpChat", `Error: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadTmpChat();
  }, []);

  const { messages, sendMessage, id, stop, status, setMessages, addToolOutput } = useChat({
    id: chatIdRef.current,
    messages: tmpChat?.messages ?? [],
    transport: new DefaultChatTransport({
      api: "/api/ai/remy",
      prepareSendMessagesRequest({ messages, id }) {
        // Check if we should persist to Supabase (after 2 messages)
        // Use ref to get latest tmpChat state
        const currentTmpChat = tmpChatRef.current;
        const shouldPersist =
          currentTmpChat?.saved || (messages.length >= 2 && !currentTmpChat?.saved);

        const messagesToSend = isClientPIIRedactionEnabled()
          ? (redactUIMessages(
              messages as Parameters<typeof redactUIMessages>[0],
            ) as typeof messages)
          : messages;

        const req = {
          body: {
            messages: messagesToSend, // Send all messages in tmp mode
            id,
            model: selectedModelRef.current,
            webSearch: useWebSearchRef.current,
            memory: useMemoriesRef.current,
            persistToSupabase: shouldPersist, // Persist after 2 messages
            isTmpChat: true, // Flag to indicate this is a tmp chat
          },
        };
        logger.log("chat", `Request being sent: ${JSON.stringify(req, null, 2)}`);
        return req;
      },
    }),
    onToolCall({ toolCall }) {
      logger.log("chat", `TOOL_CALL ${JSON.stringify(toolCall, null, 2)}`);
    },
    onData: (data) => {
      logger.log("chat", JSON.stringify(data, null, 2));
    },
    onFinish: async ({ messages }) => {
      // Save to localStorage
      if (tmpChat) {
        const shouldSaveToSupabase = messages.length >= 2 && !tmpChat.saved;

        const updatedChat: RemyTmpChat = {
          ...tmpChat,
          messages,
          updatedAt: new Date().toISOString(),
          saved: shouldSaveToSupabase, // Mark as saved if we have 2+ messages
        };
        await saveTmpChat(updatedChat);
        setTmpChat(updatedChat);
        tmpChatRef.current = updatedChat; // Update ref

        // If we have 2+ messages and not saved yet, trigger save to Supabase
        if (shouldSaveToSupabase) {
          logger.log("onFinish", `Chat has ${messages.length} messages, triggering save to Supabase`);
          // On next request, persistToSupabase will be true
        }
      }
    },
  });

  // Update tmpChat when messages change
  useEffect(() => {
    if (tmpChat && messages.length > 0) {
      const updatedChat: RemyTmpChat = {
        ...tmpChat,
        messages,
        updatedAt: new Date().toISOString(),
      };
      saveTmpChat(updatedChat);
      setTmpChat(updatedChat);
      tmpChatRef.current = updatedChat; // Update ref
    }
  }, [messages, tmpChat]);

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current && messages.length === 0 && status === "ready" && !isLoading) {
      initialMessageSent.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [initialMessage, messages.length, status, sendMessage, isLoading]);

  const handleStop = useCallback(async () => {
    stop();
    setMessages((prevMessages) => {
      const lastUserIndex = [...prevMessages]
        .reverse()
        .findIndex((msg) => msg.role === "user");
      if (lastUserIndex === -1) {
        return prevMessages;
      }
      const lastUserMsgIdx = prevMessages.length - 1 - lastUserIndex;
      let newMessages = prevMessages.slice(0, lastUserMsgIdx);
      if (
        prevMessages[lastUserMsgIdx + 1] &&
        prevMessages[lastUserMsgIdx + 1].role === "assistant"
      ) {
        newMessages = prevMessages.slice(0, lastUserMsgIdx);
      } else {
        newMessages = prevMessages.slice(0, lastUserMsgIdx);
      }
      return newMessages;
    });
  }, [stop, setMessages]);

  if (isLoading) {
    return (
      <Page>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl w-full h-full">
        <div
          className={[
            "w-full",
            "max-w-232",
            "h-full",
            "max-h-[calc(100dvh-2rem)]",
            "flex",
            "items-center",
            "justify-center",
            "overflow-hidden",
            "overscroll-x-none",
            "relative",
          ].join(" ")}
        >
          <Conversation
            className={[
              "h-full",
              "w-232",
              "relative",
              "flex",
              "flex-col",
              "items-center",
              "overflow-x-hidden",
              "overscroll-x-none",
            ].join(" ")}
            style={{ paddingBottom: "8rem" }}
          >
            <ChatThread messages={messages} />
            <ConversationScrollButton className="bottom-40" />
          </Conversation>
          <NewChatInput
            modelRef={selectedModelRef}
            useWebSearchRef={useWebSearchRef}
            useMemoriesRef={useMemoriesRef}
            sendMessage={sendMessage}
            stop={handleStop}
            status={status}
            className="absolute bottom-1 md:bottom-4 px-4 sm:px-7 w-full"
          />
        </div>
      </div>
    </Page>
  );
}

export default function RemyTmpPage() {
  return (
    <Suspense fallback={
      <Page>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Page>
    }>
      <RemyTmpPageContent />
    </Suspense>
  );
}
