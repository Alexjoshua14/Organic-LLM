import { z } from "zod";

import { resolvePersonaOwner } from "@/lib/api/persona-owner";
import { createLogger } from "@/lib/logger";
import { decidePersonaResponse } from "@/lib/personas/unified/response-gate";
import { receiptLabel } from "@/lib/personas/unified/session";
import { getPersonaStore } from "@/lib/personas/unified/store";
import { checkPersonaGateLimit } from "@/lib/rate-limit/personas";
import { getSpeakRealtimeSession } from "@/lib/rate-limit/speak-realtime";

const logger = createLogger("app/api/ai/speak/realtime/turn/route.ts");

export const maxDuration = 10;

const BodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  personaSessionId: z.uuid(),
  /** One or more consecutive transcribed utterances, joined by the client. */
  text: z.string().max(8_000),
});

/**
 * The voice persona's respond-or-hold gate. With a persona on, the Realtime session is minted
 * with `create_response: false`; the client asks here after each transcribed turn and only
 * sends `response.create` when told to. Every turn is logged to the persona session either way.
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

  const limit = await checkPersonaGateLimit(owner.ownerId);

  if (!limit.success) {
    // Over the limit, behave like a plain assistant rather than going silent.
    return Response.json({ respond: true, kind: "question", label: "Heard" });
  }

  const store = await getPersonaStore();
  const session = await store.load(owner.ownerId, parsed.data.personaSessionId);

  if (!session) return Response.json({ error: "Persona session not found" }, { status: 404 });

  const decision = await decidePersonaResponse({
    text: parsed.data.text,
    recent: session.log,
    subject: session.subject,
  });

  logger.log("POST", `Voice gate ${decision.respond ? "respond" : "hold"}`, {
    kind: decision.kind,
    source: decision.source,
  });

  void store
    .appendLog(owner.ownerId, session.id, [
      { surface: "voice", role: "user", text: parsed.data.text, held: !decision.respond },
    ])
    .catch((error) => logger.warn("POST", "Could not log voice turn", error));

  return Response.json({
    respond: decision.respond,
    kind: decision.kind,
    label: receiptLabel(decision.respond, decision.kind),
  });
}
