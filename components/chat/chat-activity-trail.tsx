"use client";

import type { FC, ReactNode } from "react";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronDownIcon, LightbulbIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../third-party/ui/collapsible";

import { useReasoningText } from "./use-reasoning-text";

import "@/styles/ChatReasoning.css";

type ChatActivityTrailProps = {
  id: string;
  /** Still working: the header shows `headline` and the activity dot. */
  isLive: boolean;
  /** Current step, e.g. the latest summary heading or "Searching the web…". */
  headline: string;
  /** Settled header, e.g. "Thought for 14s · searched 6 sources". */
  summary: string | null;
  /** Reasoning text or process tools to inspect; otherwise the header is static. */
  hasContent: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
};

/**
 * One collapsed disclosure for a message's process: reasoning summaries and process tools in
 * order. The header stays in place from live to settled; only its label changes.
 */
export const ChatActivityTrail: FC<ChatActivityTrailProps> = ({
  id,
  isLive,
  headline,
  summary,
  hasContent,
  open,
  onOpenChange,
  children,
}) => {
  if (!isLive && !summary && !hasContent) return null;

  const label = (
    <>
      <LightbulbIcon aria-hidden="true" className="chat-reasoning__icon" />
      <span aria-hidden="true" className="chat-reasoning__activity" />
      <span aria-hidden={isLive || undefined} className="chat-reasoning__label">
        {isLive ? headline : (summary ?? "Reasoning")}
      </span>
      {isLive && <span className="sr-only">Reasoning in progress</span>}
    </>
  );

  if (!hasContent) {
    return (
      <div className="chat-reasoning not-prose" data-streaming={isLive}>
        <span className="chat-reasoning__header" role={isLive ? "status" : undefined}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <Collapsible
      className="chat-reasoning not-prose"
      data-streaming={isLive}
      open={open}
      onOpenChange={onOpenChange}
    >
      <CollapsibleTrigger className="chat-reasoning__header chat-reasoning__trigger">
        {label}
        <ChevronDownIcon aria-hidden="true" className="chat-reasoning__chevron" />
      </CollapsibleTrigger>
      <CollapsibleContent
        aria-busy={isLive}
        className="chat-reasoning__content"
        data-reasoning-id={id}
      >
        <div className="chat-reasoning__steps">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};

type ChatReasoningProseProps = {
  text: string;
  /** Smooth bursty deltas; only while streaming and visible. */
  animate: boolean;
};

/** A reasoning step's summary, styled as secondary prose. */
export const ChatReasoningProse: FC<ChatReasoningProseProps> = ({ text, animate }) => {
  const reduceMotion = useReducedMotion();
  const visibleText = useReasoningText(text, animate && !reduceMotion);
  const content = useMemo(
    () => <ReactMarkdown remarkPlugins={[remarkGfm]}>{visibleText}</ReactMarkdown>,
    [visibleText]
  );

  return <div className="chat-reasoning__prose">{content}</div>;
};
