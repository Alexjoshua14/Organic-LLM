"use client";

import type { FC } from "react";

import { useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronDownIcon, LightbulbIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../third-party/ui/collapsible";

import { useReasoningText } from "./use-reasoning-text";

import "@/styles/ChatReasoning.css";

type ChatReasoningBlockProps = {
  /** Provider reasoning text (summaries); empty when the provider withheld it. */
  text: string;
  isStreaming: boolean;
  id: string;
};

/**
 * Provider reasoning as a collapsed disclosure. Without text it falls back to the
 * stable activity label while streaming and renders nothing once done.
 */
export const ChatReasoningBlock: FC<ChatReasoningBlockProps> = ({ text, isStreaming, id }) => {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const visibleText = useReasoningText(text, isStreaming && open && !reduceMotion);
  const content = useMemo(
    () => <ReactMarkdown remarkPlugins={[remarkGfm]}>{visibleText}</ReactMarkdown>,
    [visibleText]
  );
  const label = (
    <>
      <LightbulbIcon aria-hidden="true" className="chat-reasoning__icon" />
      <span aria-hidden={isStreaming || undefined}>Reasoning</span>
      {isStreaming && <span className="sr-only">Reasoning in progress</span>}
      <span aria-hidden="true" className="chat-reasoning__activity" />
    </>
  );

  if (!text) {
    return isStreaming ? (
      <div className="chat-reasoning not-prose" data-streaming="true">
        <span className="chat-reasoning__header" role="status">
          {label}
        </span>
      </div>
    ) : null;
  }

  return (
    <Collapsible
      className="chat-reasoning not-prose"
      data-streaming={isStreaming}
      open={open}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger className="chat-reasoning__header chat-reasoning__trigger">
        {label}
        <ChevronDownIcon aria-hidden="true" className="chat-reasoning__chevron" />
      </CollapsibleTrigger>
      <CollapsibleContent
        aria-busy={isStreaming}
        className="chat-reasoning__content"
        data-reasoning-id={id}
      >
        <div className="chat-reasoning__prose">{content}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};
