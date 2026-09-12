import type { UIMessage } from "ai";

export type DrawerChatTurn = {
  user: UIMessage;
  assistant: UIMessage | null;
};

/** Pair each user message with the next assistant message in chronological order. */
export function deriveDrawerChatTurns(messages: UIMessage[]): DrawerChatTurn[] {
  const turns: DrawerChatTurn[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];

    if (message.role !== "user") continue;

    let assistant: UIMessage | null = null;

    for (let j = i + 1; j < messages.length; j += 1) {
      if (messages[j].role === "user") break;
      if (messages[j].role === "assistant") {
        assistant = messages[j];
        break;
      }
    }

    turns.push({ user: message, assistant });
  }

  return turns;
}

export function clampTurnIndex(index: number, turnCount: number): number {
  if (turnCount <= 0) return 0;

  return Math.min(Math.max(0, index), turnCount - 1);
}
