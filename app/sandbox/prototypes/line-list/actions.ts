"use server";

import { UIMessage } from "ai";

import { updateMessage } from "@/data/supabase/chat";

export type UpdateWineListMessageResult = { ok: true } | { ok: false; error: string };

export async function updateWineListMessage(
  threadId: string,
  messageId: string,
  updatedMessage: UIMessage
): Promise<UpdateWineListMessageResult> {
  const result = await updateMessage(threadId, messageId, updatedMessage);

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  return { ok: true };
}
