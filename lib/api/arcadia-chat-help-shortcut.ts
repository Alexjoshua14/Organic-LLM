import type { UIMessage, UIMessageStreamWriter } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { Logger } from "@/lib/logger";
import type { ChatUIMessage } from "@/types/ai";

import { generateId } from "ai";

import {
  ARCADIA_HELP_RESPONSE,
  getLastUserMessageText,
  isArcadiaHelpQuery,
} from "@/lib/arcadia/help-response";
import { saveChat } from "@/lib/chat/chat-store";

export type TryArcadiaChatHelpShortcutParams = {
  experience: ChatExperience | undefined;
  message: UIMessage;
  validatedMessages: UIMessage[];
  assistantMessageId: string;
  chatId: string;
  sbUserId: string;
  writer: UIMessageStreamWriter<ChatUIMessage>;
  logger: Logger;
};

/**
 * Arcadia: respond with prepared "what can you do" / help without calling the model.
 * @returns true if the shortcut handled the request (caller should return early).
 */
export async function tryArcadiaChatHelpShortcut(
  params: TryArcadiaChatHelpShortcutParams
): Promise<boolean> {
  const {
    experience,
    message,
    validatedMessages,
    assistantMessageId,
    chatId,
    sbUserId,
    writer,
    logger,
  } = params;

  if (experience !== "arcadia" && experience !== "topic_explore") {
    return false;
  }

  const lastText = getLastUserMessageText(message);

  if (!isArcadiaHelpQuery(lastText)) {
    return false;
  }

  const textPartId = generateId();

  writer.write({ type: "text-start", id: textPartId });
  writer.write({
    type: "text-delta",
    id: textPartId,
    delta: ARCADIA_HELP_RESPONSE,
  });
  writer.write({ type: "text-end", id: textPartId });
  const assistantMessage: UIMessage = {
    id: assistantMessageId,
    role: "assistant",
    parts: [{ type: "text", text: ARCADIA_HELP_RESPONSE }],
  };
  const saveResult = await saveChat({
    chatId,
    messages: [...validatedMessages, assistantMessage],
    activeStreamId: null,
    useAdminForSave: true,
    ownerId: sbUserId,
  });

  if (saveResult.error) {
    logger.error("POST", "Failed to save Arcadia help response", {
      error: saveResult.error,
    });
  }

  return true;
}
