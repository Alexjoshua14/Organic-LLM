import { redis } from "@/lib/redis/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { supabaseServer } from "@/lib/supabase/server";
import { threadReferenceActor } from "@/lib/chat/thread-reference-actor";
import { parseThreadPointer } from "@/lib/chat/thread-reference";
import { recordThreadReferenceMetric } from "@/lib/chat/thread-reference-metrics-server";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const MAX_ITEMS = 20;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
const headers = { "Cache-Control": "no-store" };
const keyFor = (ownerId: string) => `thread-clipboard:v1:${ownerId}`;
const clipboardLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 h"),
  prefix: "ratelimit:thread-clipboard",
});

async function getOwnerId() {
  try {
    return await threadReferenceActor();
  } catch {
    return undefined;
  }
}

async function rateLimited(ownerId: string) {
  const result = await runLimiter("threadClipboardLimit", () => clipboardLimiter.limit(ownerId));
  return !result.success;
}

export async function GET() {
  const start = performance.now();
  const ownerId = await getOwnerId();
  if (ownerId === undefined)
    return Response.json(
      { error: "Clipboard is temporarily unavailable" },
      { status: 503, headers }
    );
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    if (await rateLimited(ownerId))
      return Response.json({ error: "Too many clipboard requests" }, { status: 429, headers });
    const ids = await redis.zrange<string[]>(keyFor(ownerId), 0, MAX_ITEMS - 1, { rev: true });
    if (!ids.length) return Response.json({ data: [] }, { headers });
    // Resolve only metadata; opening the picker never triggers a model call.
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("threads")
      .select("id, title")
      .eq("owner_id", ownerId)
      .in("id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    return Response.json(
      { data: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)] : [])) },
      { headers }
    );
  } catch {
    return Response.json({ error: "Saved clipboard is unavailable" }, { status: 503, headers });
  } finally {
    recordThreadReferenceMetric("clipboard-read", performance.now() - start);
  }
}

export async function POST(request: Request) {
  const start = performance.now();
  const ownerId = await getOwnerId();
  if (ownerId === undefined)
    return Response.json(
      { error: "Clipboard is temporarily unavailable" },
      { status: 503, headers }
    );
  if (!ownerId) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  let body: unknown;
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 1_024)
      return Response.json({ error: "Request body too large" }, { status: 413, headers });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Invalid request body" }, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_024) {
        await reader.cancel();
        return Response.json({ error: "Request body too large" }, { status: 413, headers });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(bytes);
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const id =
    typeof body === "object" &&
    body !== null &&
    "threadId" in body &&
    typeof body.threadId === "string"
      ? parseThreadPointer(body.threadId)
      : null;
  if (!id) return Response.json({ error: "Invalid thread pointer" }, { status: 400, headers });
  try {
    if (await rateLimited(ownerId))
      return Response.json({ error: "Too many clipboard requests" }, { status: 429, headers });
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("threads")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error)
      return Response.json(
        { error: "Thread verification is unavailable" },
        { status: 503, headers }
      );
    if (!data) return Response.json({ error: "Thread unavailable" }, { status: 404, headers });
    const key = keyFor(ownerId);
    // One transaction prevents concurrent device writes from dropping each other.
    const tx = redis.multi();
    tx.zadd(key, { score: Date.now(), member: id });
    tx.zremrangebyrank(key, 0, -(MAX_ITEMS + 1));
    tx.expire(key, RETENTION_SECONDS);
    await tx.exec();
    return Response.json({ saved: true }, { headers });
  } catch {
    return Response.json({ error: "Saved clipboard is unavailable" }, { status: 503, headers });
  } finally {
    recordThreadReferenceMetric("clipboard-copy", performance.now() - start);
  }
}
