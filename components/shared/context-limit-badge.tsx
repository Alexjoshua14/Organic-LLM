"use client";

// Self contained component, grabbing onto the chat instance itself

import { ContextLimitResult, getContextLimit } from "@/lib/context/chat-context-limit";
import { useSharedChatContext } from "@/lib/context/chat-context";
import { CircularProgress } from '@heroui/progress';
import { Tooltip } from "@heroui/tooltip";
import { shortenNumber, trimNumberString } from '@/lib/utils';

export const ContextLimitBadge = () => {
  // const { chatId } = useSharedChatContext();

  // const res = getContextLimit({ chatId });

  // console.log(res);

  const res: ContextLimitResult = {
    limit: 1000,
    used: 112,
  };

  const percentageUsed = trimNumberString((res.used / res.limit * 100).toFixed(1));

  const tokensUsed = trimNumberString(shortenNumber(res.used));

  const tokenLimit = trimNumberString(shortenNumber(res.limit));

  const tooltipContent = `
    ${percentageUsed}% • ${tokensUsed} / ${tokenLimit} context used
  `;

  return (
    <Tooltip content={tooltipContent}>
      <CircularProgress
        color={res.warning ? res.warning.high ? "danger" : "warning" : "success"}
        value={res.used}
        maxValue={res.limit}
        size="sm"
        showValueLabel={true}
      />
    </Tooltip>
  );
};
