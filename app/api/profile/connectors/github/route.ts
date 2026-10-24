import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { fetchGithubConnectorSnapshot } from "@/lib/connectors/github-connector";
import {
  loadUserConnectorsProfile,
  saveUserConnectorsProfile,
} from "@/lib/connectors/user-connectors-store";
import { normalizeGithubUsername } from "@/lib/schemas/user-connectors";

/**
 * GET /api/profile/connectors/github?username=<handleOrUrl>&refresh=1
 *
 * Fetches and caches the public GitHub profile + recent public repositories for the user's
 * configured GitHub handle (or the provided `username` query parameter).
 */
export async function GET(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const queryUsername = url.searchParams.get("username");
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const stored = await loadUserConnectorsProfile(user.userId);
  const candidate =
    queryUsername?.trim() || stored.githubUsername.trim() || stored.githubUrl.trim();
  const username = normalizeGithubUsername(candidate);

  if (!username) {
    return NextResponse.json(
      {
        error:
          "No valid GitHub username or profile URL provided. Enter a GitHub username (e.g. Alexjoshua14) or URL (https://github.com/Alexjoshua14).",
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

  await saveUserConnectorsProfile(user.userId, {
    githubUsername: result.snapshot.username,
    githubUrl: result.snapshot.profileUrl,
    cachedGithubSnapshot: result.snapshot,
  });

  return NextResponse.json({
    data: result.snapshot,
    cached: result.cached,
  });
}
