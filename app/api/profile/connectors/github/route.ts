import { NextResponse } from "next/server";

import { requireProfileActor } from "@/lib/api/profile-actor";
import { fetchGithubConnectorSnapshot } from "@/lib/connectors/github-connector";
import {
  loadUserConnectorsProfile,
  saveUserConnectorsProfile,
  UserConnectorsStoreError,
} from "@/lib/connectors/user-connectors-store";
import { createLogger } from "@/lib/logger";
import { normalizeGithubUsername } from "@/lib/schemas/user-connectors";

const logger = createLogger("api/profile/connectors/github");

/**
 * GET /api/profile/connectors/github?username=<handleOrUrl>&refresh=1
 *
 * Fetches and caches the public GitHub profile + recent public repositories for the user's
 * configured GitHub handle (or the provided `username` query parameter).
 */
export async function GET(req: Request) {
  const { actor, error } = await requireProfileActor();

  if (error) return error;

  const url = new URL(req.url);
  const queryUsername = url.searchParams.get("username");
  const forceRefresh = url.searchParams.get("refresh") === "1";

  let stored;

  try {
    stored = await loadUserConnectorsProfile(actor.sbUserId);
  } catch (err) {
    logger.error("GET", "Connectors profile store unavailable", {
      code: err instanceof UserConnectorsStoreError ? (err.code ?? err.operation) : null,
    });

    return NextResponse.json(
      { error: "Your connectors profile is temporarily unavailable. Try again shortly." },
      { status: 503 }
    );
  }

  const candidate =
    queryUsername?.trim() || stored.githubUsername.trim() || stored.githubUrl.trim();
  const username = normalizeGithubUsername(candidate);

  if (!username) {
    return NextResponse.json(
      {
        error:
          "No valid GitHub username or profile URL provided. Enter a GitHub username (e.g. coalescence-labs) or URL (https://github.com/coalescence-labs).",
      },
      { status: 400 }
    );
  }

  const result = await fetchGithubConnectorSnapshot(username, { forceRefresh });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  // The snapshot is public data we just fetched, so a failed save does not fail the request. It is
  // logged and reported to the caller instead of being claimed as saved.
  let persisted = true;

  try {
    await saveUserConnectorsProfile(actor.sbUserId, {
      githubUsername: result.snapshot.username,
      githubUrl: result.snapshot.profileUrl,
      cachedGithubSnapshot: result.snapshot,
    });
  } catch (err) {
    persisted = false;
    logger.error("GET", "GitHub snapshot could not be saved", {
      code: err instanceof UserConnectorsStoreError ? (err.code ?? err.operation) : null,
    });
  }

  return NextResponse.json({
    data: result.snapshot,
    cached: result.cached,
    persisted,
  });
}
