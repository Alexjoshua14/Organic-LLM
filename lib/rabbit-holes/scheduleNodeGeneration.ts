"use server";

import { after } from "next/server";
import { saveSession } from "@/data/supabase/rabbitholes";
import { RabbitHoleSessionSchema } from "@/lib/schemas/rabbitHoleSchemas";
import { runGenerationAndPersist } from "./runGenerationAndPersist";

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
    const parsed = RabbitHoleSessionSchema.safeParse(
      JSON.parse(serializedSession) as unknown,
    );
    if (!parsed.success) {
      throw new Error(
        `Invalid session for scheduling: ${parsed.error.message}`,
      );
    }
    const session = parsed.data;
    const sessionWithGenerating = {
      ...session,
      generatingNodeId: nodeId,
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
