import type { Result } from "@/types";

import { addMemoryForUser } from "@/lib/memory/operations";
import { deleteMemory, getAllMemories } from "@/lib/memory/store";
import { createLogger } from "@/lib/logger";

import type { DmzQuarantineEntry } from "./types";
import { getUserQuarantineRef } from "./quarantine-store";
import { listQuarantineEntries } from "./quarantine";

const logger = createLogger("lib/security/dmz/apply.ts");

export async function applyApprovedQuarantineEntry(
  userId: string,
  entry: DmzQuarantineEntry
): Promise<string[]> {
  const header = entry.intakeSummary
    ? `${entry.intakeSummary}\n\n`
    : `Approved DMZ intelligence (${entry.provider} · ${entry.subjectKey})\n\n`;

  const content = `${header}${entry.sanitizedText}`.slice(0, 12_000);

  const result = await addMemoryForUser(userId, {
    messages: [{ role: "user", content }],
    metadata: {
      source: "dmz_intake",
      provider: entry.provider,
      subjectKey: entry.subjectKey,
      dmzEntryId: entry.id,
    },
    infer: true,
  });

  if (result.error || !result.data?.results?.length) {
    logger.error("applyApprovedQuarantineEntry", result.error ?? "No memory results");

    return [];
  }

  return result.data.results.map((r) => r.id).filter((id): id is string => Boolean(id));
}

export async function undoDmzIntake(
  userId: string,
  entryId: string
): Promise<Result<{ deletedMemoryIds: string[] }>> {
  const list = getUserQuarantineRef(userId);
  const entry = list.find((e) => e.id === entryId);

  if (!entry) {
    return { data: null, error: new Error("Quarantine entry not found") };
  }

  const deletedMemoryIds: string[] = [];

  if (entry.memoryIds?.length) {
    const owned = await getAllMemories(userId);
    const ownedIds = new Set(owned.results?.map((m) => m.id) ?? []);

    for (const memoryId of entry.memoryIds) {
      if (!ownedIds.has(memoryId)) continue;

      try {
        const ok = await deleteMemory(memoryId);

        if (ok) deletedMemoryIds.push(memoryId);
      } catch (err) {
        logger.error(
          "undoDmzIntake",
          err instanceof Error ? err.message : `Failed to delete ${memoryId}`
        );
      }
    }
  }

  entry.memoryIds = [];
  entry.rawText = "";
  entry.sanitizedText = "";
  entry.status = "rejected";
  entry.reviewedAt = Date.now();
  entry.reviewNote = "Undone by user — removed from Organic LLM";

  return { data: { deletedMemoryIds }, error: null };
}

export function findQuarantineEntry(
  userId: string,
  entryId: string
): DmzQuarantineEntry | undefined {
  return listQuarantineEntries(userId).find((e) => e.id === entryId);
}
