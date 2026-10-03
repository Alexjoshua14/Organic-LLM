import { z } from "zod";

import { resolvePersonaOwner } from "@/lib/api/persona-owner";
import { buildPersonaInstructions } from "@/lib/personas/unified/prompt";
import { getPersonaStore } from "@/lib/personas/unified/store";
import { getSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";

const BodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  personaSessionId: z.uuid(),
});

/**
 * The current persona block for a live call. The client appends it to the base instructions it
 * received at mint and sends one `session.update`, so a new subject or photo reaches the call
 * without reconnecting — and survives truncation, which never evicts instructions.
 */
export async function POST(req: Request) {
  const owner = await resolvePersonaOwner();

  if (owner.response) return owner.response;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const live = await getSpeakRealtimeSession(parsed.data.sessionId);

  if (!live || live.userId !== owner.ownerId || live.status !== "active") {
    return Response.json({ error: "No active voice session" }, { status: 404 });
  }

  const store = await getPersonaStore();
  const session = await store.load(owner.ownerId, parsed.data.personaSessionId);

  if (!session) return Response.json({ error: "Persona session not found" }, { status: 404 });

  return Response.json({ instructions: buildPersonaInstructions(session, { surface: "voice" }) });
}
