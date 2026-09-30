import type { UIMessage } from "ai";
import type { MemoryItemType } from "@/lib/schemas/memory";

type ContextReaders = {
  memories: (userId: string) => Promise<MemoryItemType[]>;
  threadOwner: (chatId: string) => Promise<string | null>;
  messages: (chatId: string) => Promise<UIMessage[]>;
};

/** Bounded, transient context. All readers are called with a server-resolved identity. */
export async function gatherFeedbackContext(
  userId: string,
  memoryId: string,
  feedbackText: string,
  readers: ContextReaders
) {
  const memories = await readers.memories(userId);
  const selected = memories.find((memory) => memory.id === memoryId);
  const words = new Set(
    `${feedbackText} ${selected?.memory ?? ""}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 3)
  );
  const related = memories
    .filter((memory) => memory.id !== memoryId)
    .map((memory) => ({
      memory,
      score: memory.memory
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .reduce((score, word) => score + Number(words.has(word)), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ memory }) => memory.memory.slice(0, 1500));
  const chatId = selected?.metadata?.chat_id;
  let chat: Array<{ role: string; text: string }> = [];

  if (
    typeof chatId === "string" &&
    chatId.length <= 256 &&
    (await readers.threadOwner(chatId)) === userId
  ) {
    chat = (await readers.messages(chatId))
      .slice(-12)
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        text: message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n")
          .slice(0, 1500),
      }));
  }

  return {
    memory: selected?.memory.slice(0, 4000) ?? null,
    relatedMemories: related,
    recentChat: chat,
  };
}
