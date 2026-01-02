"use server";

import { auth } from "@clerk/nextjs/server";
import { createAIJob, type AIJobInsert } from "@/data/supabase/ai-jobs";
import { AIServerFunction } from "@/lib/schemas/ai-jobs";
import { Result } from "@/types";

/**
 * Server action to invoke an AI function and add it to the job queue
 * This runs on the server and persists the job, allowing it to continue
 * even if the user disconnects
 *
 * @param functionName - The AI server function to invoke (from enum)
 * @param parameters - Optional parameters for the function
 * @param priority - Job priority (1-5, default 3)
 * @returns Result containing the job ID or error
 */
export async function invokeAIServerAction(
  functionName: string,
  parameters?: Record<string, unknown>,
  priority: number = 3
): Promise<Result<{ jobId: string }>> {
  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return {
      data: null,
      error: new Error("Unauthorized"),
    };
  }

  try {
    // Validate the function name against the enum
    const validatedFunction = AIServerFunction.parse(functionName);

    // Create the job
    const job = await createAIJob({
      function: validatedFunction,
      parameters: parameters ?? {},
      priority,
      metadata: {
        userId: clerkUser.userId,
        invokedAt: new Date().toISOString(),
      },
    });

    return {
      data: { jobId: job.id },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}
