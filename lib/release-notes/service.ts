import "server-only";

import {
  getCachedReleaseNotes,
  upsertCachedReleaseNotes,
} from "@/data/supabase/release-notes-cache";
import { releaseNotesCacheKey } from "@/lib/release-notes/cache-key";
import {
  generateReleaseNotesWithLlm,
  type ReleaseNotesGenerator,
} from "@/lib/release-notes/generate";
import {
  formatCommitLogForPrompt,
  listCommitsBetween,
} from "@/lib/release-notes/git-log";
import { createSingleFlight } from "@/lib/release-notes/single-flight";
import { createLogger } from "@/lib/logger";
import type { ReleaseNotesCachePayload } from "@/lib/schemas/release-notes";

const logger = createLogger("lib/release-notes/service.ts");

const flight = createSingleFlight<ReleaseNotesServiceResult>();

export type ReleaseNotesServiceResult =
  | {
      status: "ok";
      cached: boolean;
      payload: ReleaseNotesCachePayload;
    }
  | {
      status: "empty";
      reason: "no_commits" | "git_failed" | "same_sha" | "generation_failed";
      message: string;
      fromSha: string;
      toSha: string;
      commitCount: number;
    };

export type ReleaseNotesServiceDeps = {
  getCached?: typeof getCachedReleaseNotes;
  upsertCached?: typeof upsertCachedReleaseNotes;
  listCommits?: typeof listCommitsBetween;
  generate?: ReleaseNotesGenerator;
  /** Exposed for tests — process-local single-flight map. */
  singleFlight?: typeof flight;
};

/**
 * Load or generate release notes for a SHA pair.
 * Does not generate until called (lazy). Cache key is the SHA pair.
 * Concurrent callers for the same pair share one LLM call (single-flight).
 */
export async function getOrGenerateReleaseNotes(
  args: {
    fromSha: string;
    toSha: string;
    fromVersion: string | null;
    toVersion: string | null;
  },
  deps: ReleaseNotesServiceDeps = {}
): Promise<ReleaseNotesServiceResult> {
  const getCached = deps.getCached ?? getCachedReleaseNotes;
  const upsertCached = deps.upsertCached ?? upsertCachedReleaseNotes;
  const listCommits = deps.listCommits ?? listCommitsBetween;
  const generate = deps.generate ?? generateReleaseNotesWithLlm;
  const singleFlight = deps.singleFlight ?? flight;

  const fromSha = args.fromSha.trim();
  const toSha = args.toSha.trim();
  const key = releaseNotesCacheKey({ fromSha, toSha });

  if (!fromSha || !toSha) {
    return {
      status: "empty",
      reason: "git_failed",
      message: "Missing git SHAs for this comparison.",
      fromSha,
      toSha,
      commitCount: 0,
    };
  }

  if (fromSha === toSha) {
    return {
      status: "empty",
      reason: "same_sha",
      message: "These versions point at the same commit — there is nothing to compare.",
      fromSha,
      toSha,
      commitCount: 0,
    };
  }

  const cached = await getCached({ fromSha, toSha });

  if (cached) {
    return { status: "ok", cached: true, payload: cached };
  }

  return singleFlight.run(key, async () => {
    // Re-check cache inside the flight in case another process finished first.
    const again = await getCached({ fromSha, toSha });

    if (again) {
      return { status: "ok", cached: true, payload: again };
    }

    const logResult = await listCommits({ fromSha, toSha });

    if (!logResult.ok) {
      logger.error("getOrGenerateReleaseNotes", logResult.error ?? "git failed");

      return {
        status: "empty",
        reason: "git_failed",
        message:
          "Could not read git history for this range. Release notes are only generated from real public commits.",
        fromSha,
        toSha,
        commitCount: 0,
      };
    }

    if (logResult.commits.length === 0) {
      return {
        status: "empty",
        reason: "no_commits",
        message: "No commits were found between these versions.",
        fromSha,
        toSha,
        commitCount: 0,
      };
    }

    const commitLog = formatCommitLogForPrompt(logResult.commits);

    try {
      const { notes, model } = await generate({
        fromSha,
        toSha,
        fromVersion: args.fromVersion,
        toVersion: args.toVersion,
        commitLog,
      });

      const payload: ReleaseNotesCachePayload = {
        fromSha,
        toSha,
        fromVersion: args.fromVersion,
        toVersion: args.toVersion,
        commitCount: logResult.commits.length,
        notes,
        model,
        generatedAt: new Date().toISOString(),
      };

      await upsertCached(payload);

      return { status: "ok", cached: false, payload };
    } catch (err) {
      logger.error(
        "getOrGenerateReleaseNotes",
        err instanceof Error ? err.message : String(err)
      );

      return {
        status: "empty",
        reason: "generation_failed",
        message: "Could not generate release notes right now. Try again in a moment.",
        fromSha,
        toSha,
        commitCount: logResult.commits.length,
      };
    }
  });
}

/** Test helper — access the default single-flight instance. */
export function getReleaseNotesSingleFlight() {
  return flight;
}
