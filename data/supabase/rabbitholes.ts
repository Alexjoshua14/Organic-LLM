import { Result } from "@/types";
import {
  RabbitHoleSession,
  RabbitHoleSessionSchema,
} from "@/app/rabbitholes/_lib/types";
import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

/**
 * List session metadata (index view)
 */
export async function getAllSessions(): Promise<
  Result<RabbitHoleSessionMetadata[]>
> {
  return {
    data: [],
    error: new Error("Not yet implemented"),
  };
}

/**
 * Fetch a full session by ID
 */
export async function getSessionById(
  sessionId: string
): Promise<Result<RabbitHoleSession | null>> {
  return {
    data: null,
    error: new Error("Not yet implemented"),
  };
}

/**
 * Persist a session (upsert)
 */
export async function saveSession(
  session: RabbitHoleSession
): Promise<Result<void>> {
  return {
    data: undefined,
    error: new Error("Not yet implemented"),
  };
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<Result<void>> {
  return {
    data: undefined,
    error: new Error("Not yet implemented"),
  };
}
