"use client";

import { memo, useState } from "react";

import {
  formatGetMoreChatHistoryExpandedDetail,
  type ParsedGetMoreChatHistoryToolOutput,
} from "@/lib/chat/get-more-chat-history-tool-output";

export type { ParsedGetMoreChatHistoryToolOutput };
export { tryParseGetMoreChatHistoryToolOutput } from "@/lib/chat/get-more-chat-history-tool-output";

type GetMoreChatHistoryToolResultCardProps = {
  parsed: ParsedGetMoreChatHistoryToolOutput;
};

export const GetMoreChatHistoryToolResultCard = memo(function GetMoreChatHistoryToolResultCard({
  parsed,
}: GetMoreChatHistoryToolResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (parsed.kind === "error") {
    return (
      <button
        className="not-prose block w-full cursor-pointer text-left text-xs"
        type="button"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="text-destructive/90">Additional chat history could not be fetched</span>
        {expanded ? (
          <span className="text-muted-foreground mt-0.5 block text-[10px] leading-snug">
            {parsed.message}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      className="not-prose block w-full cursor-pointer text-left text-xs text-muted-foreground"
      type="button"
      onClick={() => setExpanded((open) => !open)}
    >
      <span>Additional chat history fetched</span>
      {expanded ? (
        <span className="mt-0.5 block text-[10px] leading-snug">
          {formatGetMoreChatHistoryExpandedDetail(parsed)}
        </span>
      ) : null}
    </button>
  );
});

GetMoreChatHistoryToolResultCard.displayName = "GetMoreChatHistoryToolResultCard";
