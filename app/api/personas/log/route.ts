import { z } from "zod";

import { resolvePersonaOwner } from "@/lib/api/persona-owner";
import { PERSONA_LOG_TEXT_MAX, PersonaSurfaceSchema } from "@/lib/personas/unified/session";
import { getPersonaStore } from "@/lib/personas/unified/store";

const BodySchema = z.object({
  personaSessionId: z.uuid(),
  surface: PersonaSurfaceSchema,
  entries: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z
          .string()
          .min(1)
          .max(PERSONA_LOG_TEXT_MAX * 4),
      })
    )
    .min(1)
    .max(4),
});

/**
 * Appends finished exchanges to the persona's cross-surface log. Voice assistant replies arrive
 * here; chat logs server-side in the chat route, and voice user turns in the gate route.
 */
export async function POST(req: Request) {
  const owner = await resolvePersonaOwner();

  if (owner.response) return owner.response;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const store = await getPersonaStore();
  const session = await store.load(owner.ownerId, parsed.data.personaSessionId);

  if (!session) return Response.json({ error: "Persona session not found" }, { status: 404 });

  await store.appendLog(
    owner.ownerId,
    session.id,
    parsed.data.entries.map((entry) => ({ ...entry, surface: parsed.data.surface }))
  );

  return Response.json({ ok: true });
}
