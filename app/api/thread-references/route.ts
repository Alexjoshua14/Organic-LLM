import { threadReferenceActor } from "@/lib/chat/thread-reference-actor";
import { resolveThreadReference } from "@/lib/chat/thread-reference-resolver";
import { parseThreadPointer } from "@/lib/chat/thread-reference";
import { createThreadReferenceVoiceSeed } from "@/lib/chat/thread-reference-voice-seed";

const MAX_REQUEST_BYTES = 2_048;
const NO_STORE = { "Cache-Control": "no-store" };

function hasVoiceContext(
  reference: NonNullable<Awaited<ReturnType<typeof resolveThreadReference>>>
): reference is NonNullable<Awaited<ReturnType<typeof resolveThreadReference>>> & {
  summary: string;
  messages: Array<{ role: string; text: string }>;
} {
  return (
    "summary" in reference &&
    typeof reference.summary === "string" &&
    "messages" in reference &&
    Array.isArray(reference.messages)
  );
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES)
    throw new RangeError("Request too large");
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RangeError("Request too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof RangeError) throw error;
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await threadReferenceActor();
    if (!ownerId)
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      if (error instanceof RangeError)
        return Response.json({ error: "Request too large" }, { status: 413, headers: NO_STORE });
      return Response.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
    }
    const bodyObject =
      body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const id =
      typeof bodyObject?.threadId === "string" ? parseThreadPointer(bodyObject.threadId) : null;
    if (!id)
      return Response.json({ error: "Invalid thread pointer" }, { status: 400, headers: NO_STORE });

    const voice = bodyObject?.variant === "voice";
    const reference = await resolveThreadReference({
      ownerId,
      threadId: id,
      includeContext: voice,
    });
    if (!reference)
      return Response.json({ error: "Thread unavailable" }, { status: 404, headers: NO_STORE });
    const voiceSeed =
      voice && hasVoiceContext(reference) ? createThreadReferenceVoiceSeed(reference) : undefined;
    return Response.json(
      { data: reference, ...(voiceSeed ? { voiceSeed } : {}) },
      { headers: NO_STORE }
    );
  } catch {
    return Response.json({ error: "Unable to resolve thread" }, { status: 500, headers: NO_STORE });
  }
}
