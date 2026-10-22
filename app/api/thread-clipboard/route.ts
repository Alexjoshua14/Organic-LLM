import { redis } from "@/lib/redis/redis";
import { supabaseServer } from "@/lib/supabase/server";
import { threadReferenceActor } from "@/lib/chat/thread-reference-actor";
import { parseThreadPointer } from "@/lib/chat/thread-reference";
import { threadReferenceMetrics } from "@/lib/chat/thread-reference-metrics";

const MAX_ITEMS = 20;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
const headers = { "Cache-Control": "no-store" };
const keyFor = (ownerId: string) => `thread-clipboard:v1:${ownerId}`;

export async function GET() {
  const start = performance.now();
  const ownerId = await threadReferenceActor();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const ids = await redis.zrange<string[]>(keyFor(ownerId), 0, MAX_ITEMS - 1, { rev: true });
    if (!ids.length) return Response.json({ data: [] }, { headers });
    // Resolve only metadata; opening the picker never triggers a model call.
    const sb = await supabaseServer();
    const { data, error } = await sb.from("threads").select("id, title").eq("owner_id", ownerId).in("id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    return Response.json({ data: ids.flatMap((id) => byId.has(id) ? [byId.get(id)] : []) }, { headers });
  } catch {
    return Response.json({ error: "Saved clipboard is unavailable" }, { status: 503, headers });
  } finally { threadReferenceMetrics.record("clipboard-read", performance.now() - start); }
}

export async function POST(request: Request) {
  const start = performance.now();
  const ownerId = await threadReferenceActor();
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const body = await request.json().catch(() => null);
  const id = typeof body?.threadId === "string" ? parseThreadPointer(body.threadId) : null;
  if (!id) return Response.json({ error: "Invalid thread pointer" }, { status: 400, headers });
  const sb = await supabaseServer();
  const { data, error } = await sb.from("threads").select("id").eq("id", id).eq("owner_id", ownerId).maybeSingle();
  if (error || !data) return Response.json({ error: "Thread unavailable" }, { status: 404, headers });
  try {
    const key = keyFor(ownerId);
    // One transaction prevents concurrent device writes from dropping each other.
    const tx = redis.multi();
    tx.zadd(key, { score: Date.now(), member: id });
    tx.zremrangebyrank(key, 0, -(MAX_ITEMS + 1));
    tx.expire(key, RETENTION_SECONDS);
    await tx.exec();
    return Response.json({ saved: true }, { headers });
  } catch {
    return Response.json({ error: "Thread copied locally; saved clipboard is unavailable" }, { status: 503, headers });
  } finally { threadReferenceMetrics.record("clipboard-copy", performance.now() - start); }
}
