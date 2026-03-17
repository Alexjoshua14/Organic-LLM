// DIRECTLY COPIED FROM CHAT 12/28/25  and then expanded upon
// PLANNING TO REINTERGRATE EVENTUALLY ONCE I HAVE THINGS STABLE ENOUGH
// REENTRY SHOULD ENABLE/DISABLE various optional params, like persistedSchemas
// alowing currrent chat to stay as is forever and then aion dashboard to be enhanced.

import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { deleteChatMessage, getContext, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { fakeStreamText } from "@/lib/llm/fake-stream-text";
import { createMemorySearchTool } from "@/lib/llm/llm-tool-kit";
import { addLatestMessagesToMemoryForUser } from "@/lib/memory/operations";
import { createAionHandler, type AionDeps } from "@/lib/api/aion-handler";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const productionDeps = {
  auth: (() => auth()) as any,
  getSupabaseUserId,
  getContext,
  saveChat,
  deleteChatMessage,
  streamText: process.env.AION_TEST_MODE === "1" ? fakeStreamText : streamText,
  ensureChatHasTitle,
  updateChatSummary,
  addLatestMessagesToMemory: addLatestMessagesToMemoryForUser,
  createMemorySearchTool,
} satisfies AionDeps;

export const POST = createAionHandler(productionDeps);
