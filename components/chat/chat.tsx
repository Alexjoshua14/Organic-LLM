"use client";

import { UIMessage, useChat } from "@ai-sdk/react";
import { StickToBottom } from "use-stick-to-bottom";
import { DefaultChatTransport } from "ai";
import { useEffect } from "react";

import { ChatInput } from "./chat-input";
import { ChatThread } from "./chat-thread";
import { ChatScrollButton } from "./chat-scroll-button";

import { Thread } from "@/lib/schemas/chat";
import { ensureChatHasTitle } from "@/lib/llm/chat-helpers";

type ChatProps = {
  chatData: { thread: Thread; messages: UIMessage[] } | null;
};

export const Chat: React.FC<ChatProps> = ({ chatData }) => {
  const { messages, sendMessage, id } = useChat({
    id: chatData?.thread.id ?? "",
    messages: chatData?.messages ?? [],
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } };
      },
    }),
  });

  useEffect(() => {
    // Simply ensure chat has title when the user leaves
    return () => {
      if (chatData?.thread.id && messages.length > 3) {
        ensureChatHasTitle(chatData.thread.id);
      }
    };
  }, [chatData, messages]);

  return (
    <StickToBottom
      className="h-full w-full relative mx-2"
      initial="instant"
      resize="smooth"
    >
      {/*<div className="absolute top-0 w-full inline-block text-center justify-center p-4 bg-white/5 backdrop-blur-xl shadow">
      <span className={title()}>Welcome Chat ;)</span>
      <span className={subtitle()}>Chat ID: {chatId}</span>
    </div>*/}
      <ChatThread messages={messages} />
      <ChatScrollButton />
      <ChatInput id={id} sendMessage={sendMessage} />
    </StickToBottom>
  );
};

const sampleMessages = [
  {
    id: "1",
    role: "user" as const,
    content: "Hello! Can you help me with my React project?",
    parts: [
      {
        type: "text" as const,
        text: "Hello! Can you help me with my React project?",
      },
    ],
  },
  {
    id: "2",
    role: "assistant" as const,
    content:
      "Of course! I'd be happy to help you with your React project. What specific issue are you facing?",
    parts: [
      {
        type: "text" as const,
        text: "Of course! I'd be happy to help you with your React project. What specific issue are you facing?",
      },
    ],
  },
  {
    id: "3",
    role: "user" as const,
    content: "I'm trying to implement a chat interface with TypeScript.",
    parts: [
      {
        type: "text" as const,
        text: "I'm trying to implement a chat interface with TypeScript.",
      },
    ],
  },
  {
    id: "4",
    role: "assistant" as const,
    content:
      "That's a great project! Chat interfaces can be very engaging. Are you using any specific libraries or frameworks for the chat functionality?",
    parts: [
      {
        type: "text" as const,
        text: "That's a great project! Chat interfaces can be very engaging. Are you using any specific libraries or frameworks for the chat functionality?",
      },
    ],
  },
  {
    id: "5",
    role: "user" as const,
    content: "I'm using the AI SDK for React. Do you know about it?",
    parts: [
      {
        type: "text" as const,
        text: "I'm using the AI SDK for React. Do you know about it?",
      },
    ],
  },
  {
    id: "6",
    role: "assistant" as const,
    content:
      "Yes! The AI SDK for React is excellent for building conversational interfaces. It provides hooks like useChat that make it easy to manage chat state and streaming responses.",
    parts: [
      {
        type: "text" as const,
        text: "Yes! The AI SDK for React is excellent for building conversational interfaces. It provides hooks like useChat that make it easy to manage chat state and streaming responses.",
      },
    ],
  },
  {
    id: "7",
    role: "user" as const,
    content: "What about handling scroll behavior in chat applications?",
    parts: [
      {
        type: "text" as const,
        text: "What about handling scroll behavior in chat applications?",
      },
    ],
  },
  {
    id: "8",
    role: "assistant" as const,
    content:
      "Great question! For chat apps, you typically want to auto-scroll to the bottom when new messages arrive. Libraries like 'use-stick-to-bottom' are perfect for this - they handle smooth scrolling and let users manually scroll up to read history.",
    parts: [
      {
        type: "text" as const,
        text: "Great question! For chat apps, you typically want to auto-scroll to the bottom when new messages arrive. Libraries like 'use-stick-to-bottom' are perfect for this - they handle smooth scrolling and let users manually scroll up to read history.",
      },
    ],
  },
  {
    id: "9",
    role: "user" as const,
    content: "This is really helpful! Any tips for styling chat messages?",
    parts: [
      {
        type: "text" as const,
        text: "This is really helpful! Any tips for styling chat messages?",
      },
    ],
  },
  {
    id: "10",
    role: "assistant" as const,
    content:
      "Absolutely! Consider using different alignments for user vs assistant messages, add subtle shadows or borders, use proper spacing between messages, and consider showing timestamps. Also, make sure your chat is responsive and works well on mobile devices!",
    parts: [
      {
        type: "text" as const,
        text: "Absolutely! Consider using different alignments for user vs assistant messages, add subtle shadows or borders, use proper spacing between messages, and consider showing timestamps. Also, make sure your chat is responsive and works well on mobile devices!",
      },
    ],
  },
];
