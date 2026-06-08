import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import * as Y from "yjs";

import {
  appendStrataNoteUpdate,
  countStrataNoteUpdates,
  deleteStrataNoteUpdates,
  getStrataNoteSnapshot,
  listStrataNoteUpdates,
  upsertStrataNoteSnapshot,
} from "@/data/supabase/strata-notepad";
import { getStrataPageById } from "@/data/supabase/strata";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createLogger } from "@/lib/logger";
import { checkStrataNotepadUpdateLimit } from "@/lib/rate-limit/strata-ingest";
import {
  STRATA_NOTE_COMPACT_THRESHOLD,
  StrataYjsAppendUpdateBodySchema,
  type StrataYjsSnapshotResponse,
} from "@/lib/schemas/strata";

export const maxDuration = 30;

const logger = createLogger("app/api/prototypes/strata/notes/yjs/route.ts");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cap the bytes accepted per POST. Yjs typing updates are tiny; large pastes are still bounded. */
const MAX_UPDATE_BYTES = 512 * 1024;

function base64ToBytesNode(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function bytesToBase64Node(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function authorisePage(
  pageId: string
): Promise<{ ok: true; sbUserId: string } | { ok: false; status: number; error: string }> {
  const clerkUser = await auth();

  if (!clerkUser?.userId) return { ok: false, status: 401, error: "Unauthorized" };

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return { ok: false, status: 404, error: "User not found" };
  }

  const sbUserId = sbUserIdResult.data;
  const pageBundle = await getStrataPageById(pageId);

  if (!pageBundle || pageBundle.page.owner_id !== sbUserId) {
    return { ok: false, status: 404, error: "Strata page not found" };
  }

  return { ok: true, sbUserId };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId") ?? "";
  const noteId = url.searchParams.get("noteId") ?? "";

  if (!UUID_PATTERN.test(pageId) || !UUID_PATTERN.test(noteId)) {
    return NextResponse.json({ error: "Invalid pageId or noteId" }, { status: 400 });
  }

  const guard = await authorisePage(pageId);

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const [snapshot, updates] = await Promise.all([
      getStrataNoteSnapshot(pageId, noteId),
      listStrataNoteUpdates(pageId, noteId),
    ]);

    const response: StrataYjsSnapshotResponse = {
      noteId,
      version: snapshot?.version ?? 0,
      snapshot: snapshot ? bytesToBase64Node(snapshot.snapshot) : "",
      stateVector: snapshot ? bytesToBase64Node(snapshot.state_vector) : "",
      updates: updates.map((u) => ({
        update: bytesToBase64Node(u.update),
        createdAt: u.created_at,
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error("GET", err instanceof Error ? err.message : String(err));

    return NextResponse.json({ error: "Failed to load notepad" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let bodyJson: unknown;

  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StrataYjsAppendUpdateBodySchema.safeParse(bodyJson);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pageId, noteId, update: updateB64, clientId } = parsed.data;
  const updateBytes = base64ToBytesNode(updateB64);

  if (updateBytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty update" }, { status: 400 });
  }
  if (updateBytes.byteLength > MAX_UPDATE_BYTES) {
    return NextResponse.json({ error: "Update too large" }, { status: 413 });
  }

  const guard = await authorisePage(pageId);

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const limitResult = await checkStrataNotepadUpdateLimit(guard.sbUserId, pageId);

  if (!limitResult.success) {
    return NextResponse.json({ error: limitResult.error ?? "Too many requests" }, { status: 429 });
  }

  try {
    await appendStrataNoteUpdate({ pageId, noteId, update: updateBytes, clientId });
  } catch (err) {
    logger.error("POST", `append failed: ${err instanceof Error ? err.message : String(err)}`);

    return NextResponse.json({ error: "Failed to append update" }, { status: 500 });
  }

  let compacted = false;
  let nextVersion: number;

  try {
    const existingSnapshot = await getStrataNoteSnapshot(pageId, noteId);

    nextVersion = existingSnapshot?.version ?? 0;

    const pendingCount = await countStrataNoteUpdates(pageId, noteId);

    if (pendingCount >= STRATA_NOTE_COMPACT_THRESHOLD) {
      compacted = true;
      nextVersion = (existingSnapshot?.version ?? 0) + 1;

      const allUpdates = await listStrataNoteUpdates(pageId, noteId);
      const doc = new Y.Doc();

      if (existingSnapshot && existingSnapshot.snapshot.byteLength > 0) {
        Y.applyUpdateV2(doc, existingSnapshot.snapshot);
      }
      for (const u of allUpdates) {
        Y.applyUpdateV2(doc, u.update);
      }

      const newSnapshotBytes = Y.encodeStateAsUpdateV2(doc);
      const newStateVectorBytes = Y.encodeStateVector(doc);

      await upsertStrataNoteSnapshot({
        pageId,
        noteId,
        snapshot: newSnapshotBytes,
        stateVector: newStateVectorBytes,
        version: nextVersion,
      });

      await deleteStrataNoteUpdates(
        pageId,
        noteId,
        allUpdates.map((u) => u.id)
      );

      doc.destroy();
    }
  } catch (err) {
    logger.error(
      "POST",
      `compaction step failed (update was already persisted): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    nextVersion = 0;
    compacted = false;
  }

  return NextResponse.json({
    noteId,
    version: nextVersion,
    compacted,
  });
}
