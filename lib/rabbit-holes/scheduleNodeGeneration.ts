"use server";

import { after } from "next/server";
import { saveSession } from "@/data/supabase/rabbitholes";
import { RabbitHoleSessionSchema } from "@/lib/schemas/rabbitHoleSchemas";
import { runGenerationAndPersist } from "./runGenerationAndPersist";

/**
 * Normalize a raw session so stub/optimistic nodes satisfy schema (keyTakeaways >= 3,
 * branchSuggestions >= 5 when present). Client sends nodes with empty/short arrays.
 */
function normalizeSessionForSchedule(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const nodesById = o.nodesById as Record<string, Record<string, unknown>> | undefined;
  if (!nodesById || typeof nodesById !== "object") return raw;

  const normalizedNodes: Record<string, Record<string, unknown>> = {};
  for (const [nodeId, node] of Object.entries(nodesById)) {
    if (!node || typeof node !== "object") {
      normalizedNodes[nodeId] = node as Record<string, unknown>;
      continue;
    }
    const keyTakeaways = Array.isArray(node.keyTakeaways)
      ? (node.keyTakeaways as string[])
      : [];
    const defaultKeyTakeaways = ["Generating…", "…", "…"];
    normalizedNodes[nodeId] = {
      ...node,
      keyTakeaways:
        keyTakeaways.length >= 3
          ? keyTakeaways
          : keyTakeaways.length === 0
            ? [...defaultKeyTakeaways]
            : [...keyTakeaways, ...defaultKeyTakeaways].slice(0, 3),
    };
  }
  return { ...o, nodesById: normalizedNodes };
}

export type ScheduleNodeGenerationParams = {
  sessionId: string;
  nodeId: string;
  serializedSession?: string;
};

export type ScheduleNodeGenerationResult = {
  jobId: string;
};

/**
 * Schedules node generation and returns a job id.
 * Option A: uses after() to run runGenerationAndPersist after the response;
 * Option B (later): can be swapped to enqueue a job and return the queue job id.
 */
export async function scheduleNodeGeneration(
  params: ScheduleNodeGenerationParams,
): Promise<ScheduleNodeGenerationResult> {
  const { sessionId, nodeId, serializedSession } = params;
  const jobId = crypto.randomUUID();

  if (serializedSession) {
    const raw = JSON.parse(serializedSession) as unknown;
    const normalized = normalizeSessionForSchedule(raw);
    const parsed = RabbitHoleSessionSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new Error(
        `Invalid session for scheduling: ${parsed.error.message}`,
      );
    }
    const session = parsed.data;
    const sessionWithGenerating = {
      ...session,
      generatingNodeId: nodeId,
      generationStep: "sources" as const,
    };
    const { ok, error } = await saveSession(
      JSON.stringify(sessionWithGenerating),
    );
    if (!ok && error) {
      throw error;
    }
  }

  after(async () => {
    await runGenerationAndPersist(sessionId, nodeId);
  });

  return { jobId };
}
