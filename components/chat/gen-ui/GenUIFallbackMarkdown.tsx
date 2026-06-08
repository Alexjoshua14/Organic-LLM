"use client";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { genUIBlockToMarkdownLoose } from "@/lib/schemas/gen-ui";

type GenUIFallbackMarkdownProps = {
  raw: unknown;
  messageId?: string;
};

export function GenUIFallbackMarkdown({ raw, messageId = "gen-ui-fallback" }: GenUIFallbackMarkdownProps) {
  const markdown = genUIBlockToMarkdownLoose(raw);
  return <ChatMessageMarkdown content={markdown} id={messageId} />;
}
