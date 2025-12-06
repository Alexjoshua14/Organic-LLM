"use client";

import { RabbitHoleSession, RabbitHoleSessionSchema } from "./types";

const SESSIONS_KEY = "rabbit-hole-sessions";
const CURRENT_SESSION_KEY = "rabbit-hole-session";

export interface RabbitHoleSessionMetadata {
  sessionId: string;
  rootQuestion: string;
  createdAt: string;
  updatedAt: string;
  pathLength: number;
  summary?: string;
}

export function getAllSessions(): RabbitHoleSessionMetadata[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    console.warn("Failed to read sessions from localStorage:", error);
    return [];
  }
}

export function getSessionById(sessionId: string): RabbitHoleSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(`${CURRENT_SESSION_KEY}-${sessionId}`);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const validated = RabbitHoleSessionSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }

    return null;
  } catch (error) {
    console.warn("Failed to read session from localStorage:", error);
    return null;
  }
}

export function saveSession(session: RabbitHoleSession): void {
  if (typeof window === "undefined") return;

  try {
    // Save the full session
    localStorage.setItem(
      `${CURRENT_SESSION_KEY}-${session.sessionId}`,
      JSON.stringify(session)
    );

    // Update the sessions list
    const sessions = getAllSessions();
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
  } catch (error) {
    console.warn("Failed to save session to localStorage:", error);
  }
}

export function deleteSession(sessionId: string): void {
  if (typeof window === "undefined") return;

  try {
    // Remove the full session
    localStorage.removeItem(`${CURRENT_SESSION_KEY}-${sessionId}`);

    // Remove from sessions list
    const sessions = getAllSessions();
    const filtered = sessions.filter((s) => s.sessionId !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.warn("Failed to delete session from localStorage:", error);
  }
}
