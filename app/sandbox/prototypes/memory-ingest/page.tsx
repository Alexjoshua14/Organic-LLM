import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getLatestThreadByFeature } from "@/data/supabase/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createMemoryIngestThread } from "@/lib/chat/create-memory-ingest-thread";
import { MEMORY_INGEST_FEATURE, MEMORY_INGEST_RESUME_WINDOW_MS } from "@/lib/chat/memory-ingest";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/prototypes/memory-ingest/page.tsx");

/**
 * Memory ingest chamber entry. Recency-aware: re-entering within
 * {@link MEMORY_INGEST_RESUME_WINDOW_MS} of the last session's activity resumes
 * that session (its latest message is hydrated by the `[slug]` page); past that
 * window — or with no prior session — a fresh, `memory-ingest`-tagged session is
 * created. The tag keeps these threads out of the main chat sidebar.
 */
export default async function MemoryIngestNewPage() {
  const { userId } = await auth();

  if (userId) {
    const ownerRes = await getSupabaseUserId(userId);
    const ownerId = ownerRes.error ? null : ownerRes.data;

    if (ownerId) {
      const latestRes = await getLatestThreadByFeature(ownerId, MEMORY_INGEST_FEATURE);

      if (!latestRes.error && latestRes.data) {
        const lastActiveMs = Date.parse(latestRes.data.updatedAt);
        const withinResumeWindow =
          Number.isFinite(lastActiveMs) &&
          Date.now() - lastActiveMs < MEMORY_INGEST_RESUME_WINDOW_MS;

        if (withinResumeWindow) {
          redirect(`/sandbox/prototypes/memory-ingest/${latestRes.data.id}`);
        }
      }
    }
  }

  const created = await createMemoryIngestThread();

  if (!created.ok) {
    logger.error("MemoryIngestNewPage", created.error);
    redirect("/sandbox/prototypes");
  }

  redirect(created.path);
}
