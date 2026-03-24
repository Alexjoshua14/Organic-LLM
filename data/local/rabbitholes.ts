import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

import { Result } from "@/types";
import { RabbitHoleSession, RabbitHoleSessionSchema } from "@/lib/schemas/rabbitHoleSchemas";

const SESSIONS_KEY = "rabbit-hole-sessions";
const CURRENT_SESSION_KEY = "rabbit-hole-session";

// Flag to prevent infinite recursion between cleanup and getAllSessions
let isCleaningUp = false;

/**
 * Clean up orphaned full sessions that are no longer in the metadata list
 * This helps prevent localStorage quota issues
 */
export function cleanupOrphanedSessions(): void {
  if (typeof window === "undefined" || isCleaningUp) return;

  isCleaningUp = true;
  try {
    // Read metadata directly to avoid recursion
    const stored = localStorage.getItem(SESSIONS_KEY);

    if (!stored) {
      isCleaningUp = false;

      return;
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      isCleaningUp = false;

      return;
    }

    const validSessionIds = new Set(parsed.map((s: any) => s?.sessionId).filter(Boolean));

    // Find all localStorage keys that match the session pattern
    const allKeys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(`${CURRENT_SESSION_KEY}-`)) {
        allKeys.push(key);
      }
    }

    // Delete sessions that are no longer in the metadata list
    let cleanedCount = 0;

    for (const key of allKeys) {
      const sessionId = key.replace(`${CURRENT_SESSION_KEY}-`, "");

      if (!validSessionIds.has(sessionId)) {
        localStorage.removeItem(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} orphaned RabbitHole sessions`);
    }
  } catch (err) {
    console.warn("Failed to cleanup orphaned sessions:", err);
  } finally {
    isCleaningUp = false;
  }
}

/**
 * List session metadata (index view)
 */
export async function getAllSessions(): Promise<Result<RabbitHoleSessionMetadata[]>> {
  const error = {
    data: [],
    error: new Error("Failed to read sessions from localStorage"),
  };

  if (typeof window === "undefined")
    return {
      data: [],
      error: null,
    };

  try {
    // Clean up orphaned sessions when listing (helps prevent quota issues)
    cleanupOrphanedSessions();

    const stored = localStorage.getItem(SESSIONS_KEY);

    if (!stored)
      return {
        data: [],
        error: null,
      };

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) return error;

    // Validate using schema for each session
    const validated = parsed
      .map((s: unknown) => RabbitHoleSessionSchema.safeParse(s))
      .filter((r) => r.success)
      .map((r) => {
        // extract relevant metadata for session list view
        const session = r.data;
        const rootNodeId = session.path[0]?.nodeId;
        const rootNode = rootNodeId ? session.nodesById[rootNodeId] : null;
        const summary = rootNode?.keyTakeaways
          ? rootNode.keyTakeaways.slice(0, 2).join(" • ")
          : undefined;

        const createdAt = session.createdAt ?? new Date().toISOString();
        const updatedAt = session.updatedAt ?? createdAt;

        return {
          sessionId: session.sessionId,
          rootQuestion: session.rootQuestion,
          rootTitle: session.path[0]?.label,
          createdAt,
          updatedAt,
          pathLength: session.path?.length ?? 0,
          summary,
        } as RabbitHoleSessionMetadata;
      });

    if (!Array.isArray(validated)) return error;

    return {
      data: validated,
      error: null,
    };
  } catch (err) {
    console.warn("Failed to read sessions from localStorage:", err);

    return error;
  }
}

/**
 * Fetch a full session by ID
 */
export async function getSessionById(sessionId: string): Promise<Result<RabbitHoleSession | null>> {
  const error = {
    data: null,
    error: new Error("Failed to read session from localStorage"),
  };

  if (typeof window === "undefined")
    return {
      data: null,
      error: null,
    };

  try {
    const stored = localStorage.getItem(`${CURRENT_SESSION_KEY}-${sessionId}`);

    if (!stored) return error;

    const parsed = JSON.parse(stored);

    // Validate parsed
    const sessionData = RabbitHoleSessionSchema.safeParse(parsed);

    if (sessionData.error) {
      throw new Error(sessionData.error.message);
    }

    if (!sessionData.data) {
      throw new Error("Unable to parse session data");
    }

    return {
      data: sessionData.data,
      error: null,
    };
  } catch (err) {
    console.warn("Failed to read session from localStorage:", err);

    return error;
  }
}

/**
 * Persist a session (upsert)
 */
export async function saveSession(session: RabbitHoleSession): Promise<Result<boolean>> {
  const error = {
    data: false,
    error: new Error("Failed to save session"),
  };

  if (typeof window === "undefined")
    return {
      data: false,
      error: null,
    };

  try {
    // Clean up orphaned sessions before saving to prevent quota issues
    cleanupOrphanedSessions();

    // Save the full session
    try {
      localStorage.setItem(`${CURRENT_SESSION_KEY}-${session.sessionId}`, JSON.stringify(session));
    } catch (quotaError: any) {
      // If quota exceeded, try cleaning up more aggressively and retry
      if (quotaError?.name === "QuotaExceededError") {
        console.warn("localStorage quota exceeded, attempting aggressive cleanup...");

        // Get current sessions and keep only the most recent 20
        const sessionsRes = await getAllSessions();

        if (!sessionsRes.error && sessionsRes.data) {
          const limitedSessions = sessionsRes.data.slice(0, 20);
          const validSessionIds = new Set(limitedSessions.map((s) => s.sessionId));

          // Delete all sessions not in the top 20
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);

            if (key && key.startsWith(`${CURRENT_SESSION_KEY}-`)) {
              const sessionId = key.replace(`${CURRENT_SESSION_KEY}-`, "");

              if (!validSessionIds.has(sessionId)) {
                localStorage.removeItem(key);
              }
            }
          }

          // Update metadata list
          localStorage.setItem(SESSIONS_KEY, JSON.stringify(limitedSessions));

          // Retry saving
          localStorage.setItem(
            `${CURRENT_SESSION_KEY}-${session.sessionId}`,
            JSON.stringify(session)
          );
        } else {
          throw quotaError;
        }
      } else {
        throw quotaError;
      }
    }

    // Update the sessions list
    const sessionsRes = await getAllSessions();
    let sessions: RabbitHoleSessionMetadata[];

    if (sessionsRes.error || sessionsRes.data === null) {
      return error;
    } else {
      sessions = sessionsRes.data;
    }

    const existingIndex = sessions.findIndex((s) => s.sessionId === session.sessionId);

    // Generate a summary from the root node's key takeaways
    const rootNodeId = session.path[0]?.nodeId;
    const rootNode = rootNodeId ? session.nodesById[rootNodeId] : null;
    const summary = rootNode?.keyTakeaways
      ? rootNode.keyTakeaways.slice(0, 2).join(" • ")
      : undefined;

    const metadata: RabbitHoleSessionMetadata = {
      sessionId: session.sessionId,
      rootQuestion: session.rootQuestion,
      rootTitle: session.path[0]?.label,
      createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pathLength: session.path.length,
      summary,
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = metadata;
    } else {
      sessions.unshift(metadata);
    }

    // Keep only the most recent 50 sessions
    const limitedSessions = sessions.slice(0, 50);

    localStorage.setItem(SESSIONS_KEY, JSON.stringify(limitedSessions));

    // Clean up old full sessions that are no longer in the metadata list
    // This prevents localStorage quota from being exceeded
    cleanupOrphanedSessions();

    return {
      data: true,
      error: null,
    };
  } catch (err) {
    console.warn("Failed to save session to localStorage:", err);

    return error;
  }
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<Result<boolean>> {
  const error = {
    data: false,
    error: new Error("Failed to delete session"),
  };

  if (typeof window === "undefined")
    return {
      data: false,
      error: null,
    };

  try {
    // Remove the full session
    localStorage.removeItem(`${CURRENT_SESSION_KEY}-${sessionId}`);

    // Remove from sessions list
    const sessionsRes = await getAllSessions();
    let sessions: RabbitHoleSessionMetadata[];

    if (sessionsRes.error || sessionsRes.data === null) {
      return error;
    } else {
      sessions = sessionsRes.data;
    }

    const filtered = sessions.filter((s) => s.sessionId !== sessionId);

    localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));

    return {
      data: true,
      error: null,
    };
  } catch (err) {
    console.warn("Failed to delete session from localStorage:", err);

    return error;
  }
}
