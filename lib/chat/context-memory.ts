import type { UIMessage } from "ai";

import { readActivatedMemories } from "@/lib/memory/activated-thread-memories";

/** Opaque references only. Memory text stays in the encrypted message/tool payload. */
export type ContextMemoryReference = {
  id: string;
  messageId: string;
  source: "automatic" | "tool";
};

const MEMORY_READ_TOOLS = new Set(["search_memories", "list_recent_memories"]);

/** The legacy no-id fallback contains fact text; don't repeat it in HUD metadata. */
function referenceId(id: string): string {
  if (!id.startsWith("text:")) return id;

  let hash = 0xcbf29ce484222325n;

  for (const character of id) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(character.codePointAt(0)!)) * 0x100000001b3n);
  }

  return `anonymous:${hash.toString(16)}`;
}

/** Count returned facts, never an overfetch inventory or a tool's claimed count. */
export function memoryReferencesFromToolResult(
  toolName: string,
  output: unknown,
  messageId: string
): ContextMemoryReference[] {
  if (!MEMORY_READ_TOOLS.has(toolName) || !output || typeof output !== "object") return [];

  const result = output as { success?: unknown; memories?: unknown };

  if (result.success === false || !Array.isArray(result.memories)) return [];

  return result.memories.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const row = item as { id?: unknown; memory?: unknown };
    const text = typeof row.memory === "string" ? row.memory.trim().replace(/\s+/g, " ") : "";

    if (!text) return [];

    const id =
      typeof row.id === "string" && row.id.trim() ? row.id.trim() : `text:${text.toLowerCase()}`;

    return [{ id: referenceId(id), messageId, source: "tool" as const }];
  });
}

export function getContextMemoryReferences(messages: UIMessage[]): ContextMemoryReference[] {
  return messages.flatMap((message) => [
    ...readActivatedMemories(message).map((memory) => ({
      id: referenceId(memory.id),
      messageId: message.id,
      source: "automatic" as const,
    })),
    ...message.parts.flatMap((part) => {
      if (!("state" in part) || part.state !== "output-available" || !("output" in part)) return [];

      const toolName =
        part.type === "dynamic-tool" && "toolName" in part
          ? part.toolName
          : part.type.startsWith("tool-")
            ? part.type.slice(5)
            : "";

      return memoryReferencesFromToolResult(toolName, part.output, message.id);
    }),
  ]);
}

export function mergeContextMemoryReferences(
  references: ContextMemoryReference[]
): ContextMemoryReference[] {
  const seen = new Set<string>();

  return references.filter((reference) => {
    const key = JSON.stringify([reference.id, reference.messageId, reference.source]);

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

export function summarizeContextMemories(references: ContextMemoryReference[]) {
  const automatic = new Set(
    references.filter((ref) => ref.source === "automatic").map((ref) => ref.id)
  );
  const tools = new Set(references.filter((ref) => ref.source === "tool").map((ref) => ref.id));

  return {
    total: new Set(references.map((ref) => ref.id)).size,
    automatic: automatic.size,
    tools: tools.size,
    overlap: [...tools].filter((id) => automatic.has(id)).length,
  };
}
