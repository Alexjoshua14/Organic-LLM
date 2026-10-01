import { z } from "zod";

import { resolvePersonaOwner } from "@/lib/api/persona-owner";
import { createLogger } from "@/lib/logger";
import { findPersonaStarter } from "@/lib/personas/unified/registry";
import {
  PERSONA_SUBJECT_MAX,
  PersonaIdSchema,
  PersonaStarterIdSchema,
} from "@/lib/personas/unified/session";
import { getPersonaStore } from "@/lib/personas/unified/store";

const logger = createLogger("app/api/personas/session/route.ts");

const NO_STORE = { "Cache-Control": "no-store" };

/** The session the user has switched on, if any. */
export async function GET() {
  const owner = await resolvePersonaOwner();

  if (owner.response) return owner.response;
  try {
    const store = await getPersonaStore();

    return Response.json({ session: await store.active(owner.ownerId) }, { headers: NO_STORE });
  } catch (error) {
    logger.error("GET", "Could not load persona session", error);

    return Response.json({ error: "Could not load your persona" }, { status: 503 });
  }
}

const PostSchema = z.object({
  personaId: PersonaIdSchema,
  /** `resume` picks the last session back up; `new` always starts a fresh one. */
  mode: z.enum(["resume", "new"]).default("resume"),
  starterId: PersonaStarterIdSchema.optional(),
  subject: z.string().trim().max(PERSONA_SUBJECT_MAX).optional(),
});

/** Switches a persona on: resumes the latest session or starts a new one. */
export async function POST(req: Request) {
  const owner = await resolvePersonaOwner();

  if (owner.response) return owner.response;
  const parsed = PostSchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) return Response.json({ error: "Invalid persona request" }, { status: 400 });

  try {
    const store = await getPersonaStore();
    const { personaId, mode, starterId } = parsed.data;

    if (mode === "resume") {
      const latest = await store.latest(owner.ownerId);

      if (latest && latest.personaId === personaId) {
        await store.activate(owner.ownerId, latest.id);

        return Response.json({ session: latest });
      }
    }

    const starter = findPersonaStarter(starterId);
    const session = await store.create(owner.ownerId, {
      personaId,
      starterId: starter?.id ?? null,
      subject: parsed.data.subject ?? starter?.subject ?? "",
    });

    return Response.json({ session });
  } catch (error) {
    logger.error("POST", "Could not start persona session", error);

    return Response.json({ error: "Could not start your persona" }, { status: 503 });
  }
}

const PatchSchema = z.object({
  id: z.uuid(),
  subject: z.string().trim().max(PERSONA_SUBJECT_MAX).optional(),
  starterId: PersonaStarterIdSchema.nullable().optional(),
  /** `false` switches the persona off; the session stays to resume later. */
  active: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const owner = await resolvePersonaOwner();

  if (owner.response) return owner.response;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) return Response.json({ error: "Invalid persona update" }, { status: 400 });

  try {
    const store = await getPersonaStore();
    const { id, active, subject, starterId } = parsed.data;

    if (active === false) {
      await store.activate(owner.ownerId, null);

      return Response.json({ session: null });
    }
    if (active === true && !(await store.activate(owner.ownerId, id))) {
      return Response.json({ error: "Persona session not found" }, { status: 404 });
    }

    const starter = starterId ? findPersonaStarter(starterId) : null;
    const session =
      subject !== undefined || starterId !== undefined
        ? await store.update(owner.ownerId, id, {
            subject: subject ?? starter?.subject,
            starterId,
          })
        : await store.load(owner.ownerId, id);

    return session
      ? Response.json({ session })
      : Response.json({ error: "Persona session not found" }, { status: 404 });
  } catch (error) {
    logger.error("PATCH", "Could not update persona session", error);

    return Response.json({ error: "Could not save your persona" }, { status: 503 });
  }
}
