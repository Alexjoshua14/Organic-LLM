import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getOrGenerateReleaseNotes } from "@/lib/release-notes/service";
import {
  buildVersionCatalog,
  resolveCompareRange,
  resolveIncrementRange,
} from "@/lib/release-notes/versions";

export const dynamic = "force-dynamic";

/**
 * GET /api/release-notes
 * - No generate params: return version catalog only (never calls the model).
 * - ?version=X: notes for previous → X (generates only on cache miss).
 * - ?from=A&to=B: compare two versions (generates only on cache miss).
 */
export async function GET(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const version = searchParams.get("version");
  const fromVersion = searchParams.get("from");
  const toVersion = searchParams.get("to");

  let catalog;

  try {
    catalog = await buildVersionCatalog();
  } catch {
    return NextResponse.json(
      {
        error: "git_unavailable",
        message: "Could not read version history from git.",
        versions: [],
        currentVersion: null,
        previousVersion: null,
      },
      { status: 503 }
    );
  }

  const catalogPayload = {
    versions: catalog.versions.map((v) => ({ version: v.version, sha: v.sha })),
    currentVersion: catalog.currentVersion,
    currentSha: catalog.currentSha,
    previousVersion: catalog.previousVersion,
    previousSha: catalog.previousSha,
  };

  // Catalog only — do not generate.
  if (!version && !fromVersion && !toVersion) {
    return NextResponse.json(catalogPayload);
  }

  let fromSha: string | null = null;
  let toSha: string | null = null;
  let fromLabel: string | null = null;
  let toLabel: string | null = null;

  if (fromVersion && toVersion) {
    const range = resolveCompareRange(catalog, fromVersion, toVersion);

    fromSha = range.fromSha;
    toSha = range.toSha;
    fromLabel = range.fromVersion;
    toLabel = range.toVersion;
  } else if (version) {
    const range = await resolveIncrementRange(catalog, version);

    fromSha = range.fromSha;
    toSha = range.toSha;
    fromLabel = range.fromVersion;
    toLabel = version;
  } else {
    return NextResponse.json(
      { error: "Provide version= or both from= and to=" },
      { status: 400 }
    );
  }

  if (!toSha) {
    return NextResponse.json(
      {
        ...catalogPayload,
        result: {
          status: "empty",
          reason: "unresolved",
          message: "Could not resolve that version to a git commit.",
        },
      },
      { status: 404 }
    );
  }

  if (!fromSha) {
    return NextResponse.json({
      ...catalogPayload,
      result: {
        status: "empty",
        reason: "no_previous",
        message: "There is no earlier version to compare against.",
        toVersion: toLabel,
        toSha,
        fromVersion: null,
        fromSha: null,
        commitCount: 0,
      },
    });
  }

  const result = await getOrGenerateReleaseNotes({
    fromSha,
    toSha,
    fromVersion: fromLabel,
    toVersion: toLabel,
  });

  return NextResponse.json({ ...catalogPayload, result });
}
