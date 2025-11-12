import { UIMessage } from "ai";

import { Message } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/chat/message-transform.ts");

export function convertMessageToUIMessage(message: Message): UIMessage | null {
  try {
    switch (message.schema_kind) {
      case "ui_message":
        const uiMessage: UIMessage = JSON.parse(message.content);

        return uiMessage;
      default:
        logger.error(
          "convertMessageToUIMessage",
          `Unknown schema kind: ${message.schema_kind}`
        );

        return null;
    }
  } catch (error) {
    logger.error(
      "convertMessageToUIMessage",
      `Error converting message to UIMessage: ${error}`
    );

    return null;
  }
}

export function convertUIMessageToMessage(
  uiMessage: UIMessage,
  chatId: string
): Message | null {
  try {
    const message: Message = {
      content: JSON.stringify(uiMessage),
      role: uiMessage.role,
      id: uiMessage.id,
      thread_id: chatId,
      schema_kind: "ui_message",
      schema_version: 1,
    };

    return message;
  } catch (error) {
    logger.error(
      "convertUIMessageToMessage",
      `Error converting UIMessage to Message: ${error}`
    );

    return null;
  }
}
