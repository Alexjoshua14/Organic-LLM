import { Result } from "@/types";
import {
  RabbitHoleSession,
  RabbitHoleSessionSchema,
} from "@/app/rabbitholes/_lib/types";
import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

const SESSIONS_KEY = "rabbit-hole-sessions";
const CURRENT_SESSION_KEY = "rabbit-hole-session";

/**
 * List session metadata (index view)
 */
export async function getAllSessions(): Promise<
  Result<RabbitHoleSessionMetadata[]>
> {
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
        return {
          sessionId: session.sessionId,
          rootQuestion: session.rootQuestion,
          pathLength: session.path?.length ?? 0,
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
export async function getSessionById(
  sessionId: string
): Promise<Result<RabbitHoleSession | null>> {
  const error = {
    data: null,
    error: new Error("Failed to read session from localStorage"),
  };

  return {
    data: null,
    error: new Error("Not Yet Implemented"),
  };
}

/**
 * Persist a session (upsert)
 */
export async function saveSession(
  session: RabbitHoleSession
): Promise<Result<boolean>> {
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
    // Save the full session
    localStorage.setItem(
      `${CURRENT_SESSION_KEY}-${session.sessionId}`,
      JSON.stringify(session)
    );

    // Update the sessions list
    const sessionsRes = await getAllSessions();
    let sessions: RabbitHoleSessionMetadata[];

    if (sessionsRes.error || sessionsRes.data === null) {
      return error;
    } else {
      sessions = sessionsRes.data;
    }

    const existingIndex = sessions.findIndex(
      (s) => s.sessionId === session.sessionId
    );

    // Generate a summary from the root node's key takeaways
    const rootNodeId = session.path[0]?.nodeId;
    const rootNode = rootNodeId ? session.nodesById[rootNodeId] : null;
    const summary = rootNode?.keyTakeaways
      ? rootNode.keyTakeaways.slice(0, 2).join(" • ")
      : undefined;

    const metadata: RabbitHoleSessionMetadata = {
      sessionId: session.sessionId,
      rootQuestion: session.rootQuestion,
      createdAt:
        existingIndex >= 0
          ? sessions[existingIndex].createdAt
          : new Date().toISOString(),
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
export async function deleteSession(
  sessionId: string
): Promise<Result<boolean>> {
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
