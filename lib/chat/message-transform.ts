import { UIMessage } from "ai";

import { Message } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { Mem0Message } from "../schemas/memory";
import { Message as Mem0MessageType } from "mem0ai/oss";

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

export function convertUIMessageToMem0Message(
  uiMessage: UIMessage,
  chatID: string
): Mem0MessageType {
  const message = Mem0Message.parse({
    role: uiMessage.role,
    content:
      uiMessage.parts
        .filter((part) => part.type === "text")
        .reduce((acc, part) => acc + part.text, "") ?? "",
  });

  return message;
}
