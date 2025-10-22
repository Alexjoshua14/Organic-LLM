"use client";

// Self contained component, grabbing onto the chat instance itself

import { Badge } from "../third-party/ui/badge";

import { getContextLimit } from "@/lib/context/chat-context-limit";
import { useSharedChatContext } from "@/lib/context/chat-context";

export const ContextLimitBadge = () => {
  const { chatId } = useSharedChatContext();

  const res = getContextLimit({ chatId });

  console.log(res);

  return <Badge variant="outline">{res.limit}</Badge>;
};
