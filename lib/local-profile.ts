/**
 * Reads the gitignored `.local-profile.md` at the repo root.
 * Server-only (uses `fs`) — safe to import in API routes, server components,
 * and LLM system-prompt builders. Returns null if the file doesn't exist.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LOCAL_PROFILE_PATH = join(process.cwd(), ".local-profile.md");

/**
 * Returns the raw markdown string from `.local-profile.md`, or null
 * if the file is missing or unreadable.
 */
export async function getLocalProfile(): Promise<string | null> {
  try {
    const content = await readFile(LOCAL_PROFILE_PATH, "utf-8");

    return content.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Synchronous variant for contexts where async isn't convenient
 * (e.g. middleware, config builders).
 */
export function getLocalProfileSync(): string | null {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const content = fs.readFileSync(LOCAL_PROFILE_PATH, "utf-8");

    return content.trim() || null;
  } catch {
    return null;
  }
}
