import { z } from "zod";

import {
  readJsonWithLimit,
  RequestTooLargeError,
  resolvePersonaOwner,
} from "@/lib/api/persona-owner";
import { createLogger } from "@/lib/logger";
import { reducePaintingState } from "@/lib/personas/domains/acrylic/painting-reducer";
import {
  MAX_PAINTING_REQUEST_BYTES,
  PaintingAnalysisRequestSchema,
} from "@/lib/personas/domains/acrylic/painting-state";
import { getPersonaStore } from "@/lib/personas/unified/store";
import { checkPaintingAnalysisLimit } from "@/lib/rate-limit/personas";

const logger = createLogger("app/api/personas/painting/route.ts");

// Two vision calls plus a reduce call; each typically a few seconds.
export const maxDuration = 60;

/** A data URL's declared type must match the bytes before anything goes to a provider. */
function isRasterDataUrl(dataUrl: string): boolean {
  const [prefix, encoded] = dataUrl.split(",", 2);
  const bytes = Buffer.from(encoded ?? "", "base64");

  if (bytes.length < 12) return false;
  if (prefix === "data:image/jpeg;base64")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (prefix === "data:image/png;base64") return bytes.toString("hex", 0, 8) === "89504e470d0a1a0a";

  return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

/** Analyses a progress photo and advances the session's painting state. */
export async function POST(req: Request) {
  const owner = await resolvePersonaOwner();

  if (owner.response) return owner.response;

  let body: unknown;

  try {
    body = await readJsonWithLimit(req, MAX_PAINTING_REQUEST_BYTES);
  } catch (error) {
    return error instanceof RequestTooLargeError
      ? Response.json({ error: "That photo is too large. Try a smaller one." }, { status: 413 })
      : Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = PaintingAnalysisRequestSchema.safeParse(body);

  if (
    !parsed.success ||
    !isRasterDataUrl(parsed.data.currentImage) ||
    (parsed.data.differenceImage && !isRasterDataUrl(parsed.data.differenceImage))
  ) {
    return Response.json({ error: "Invalid photo" }, { status: 400 });
  }

  const limit = await checkPaintingAnalysisLimit(owner.ownerId);

  if (!limit.success) {
    return Response.json(
      { error: "Too many photos this hour. Try again a little later." },
      { status: 429 }
    );
  }

  try {
    const store = await getPersonaStore();
    const { personaSessionId, currentImage, differenceImage, metrics, note } = parsed.data;
    const [session, previousImage] = await Promise.all([
      store.load(owner.ownerId, personaSessionId),
      store.loadPhoto(owner.ownerId, personaSessionId),
    ]);

    if (!session) return Response.json({ error: "Persona session not found" }, { status: 404 });

    const result = await reducePaintingState(
      {
        previousState: session.work,
        // A comparison only means something against the photo the current state came from.
        previousImage: session.work ? previousImage : null,
        currentImage,
        differenceImage: session.work ? differenceImage : undefined,
        metrics,
        subject: session.subject,
        note,
      },
      { signal: req.signal }
    );

    logger.log("POST", `Painting analysis ${result.outcome}`, {
      trace: result.trace.map(
        (entry) =>
          `${entry.branch}:${entry.status}:${entry.ms}ms${entry.reason ? `(${entry.reason})` : ""}`
      ),
    });

    const saved =
      result.outcome === "updated" || result.outcome === "unchanged"
        ? await store.saveWork(owner.ownerId, personaSessionId, result.state, currentImage)
        : session;

    return Response.json({
      session: saved ?? session,
      outcome: result.outcome,
      summary: "summary" in result ? result.summary : null,
      trace: result.trace,
    });
  } catch (error) {
    logger.error("POST", "Painting analysis failed", error);

    return Response.json({ error: "Could not read that photo. Try again." }, { status: 502 });
  }
}

const GetSchema = z.object({ personaSessionId: z.uuid() });

/** The photo the current painting state came from, so the browser can compute a difference. */
export async function GET(req: Request) {
  const owner = await resolvePersonaOwner();

  if (owner.response) return owner.response;
  const parsed = GetSchema.safeParse({
    personaSessionId: new URL(req.url).searchParams.get("personaSessionId"),
  });

  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const store = await getPersonaStore();
  const image = await store.loadPhoto(owner.ownerId, parsed.data.personaSessionId);

  return Response.json({ image }, { headers: { "Cache-Control": "no-store" } });
}
