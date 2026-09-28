import { resolveFeedbackUser } from "@/lib/memory/feedback";
import { draftFeedbackNote } from "@/lib/memory/feedback-draft";
import { FEEDBACK_CONFLICT } from "@/lib/memory/feedback-service";
import { FeedbackDraftInputSchema } from "@/lib/schemas/memory-quality";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  try {
    const userId = await resolveFeedbackUser();

    if (!userId) return Response.json({ error: "Not signed in" }, { status: 401, headers });
    const limit = await checkLlmMessageLimit(userId);

    if (!limit.success)
      return Response.json({ error: "Please wait before trying again." }, { status: 429, headers });
    const body = await request.text();

    if (body.length > 65000)
      return Response.json({ error: "Feedback is too long." }, { status: 413, headers });
    let json: unknown;

    try {
      json = JSON.parse(body);
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    }
    const parsed = FeedbackDraftInputSchema.safeParse(json);

    if (!parsed.success)
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25000)]);

    return Response.json(await draftFeedbackNote(userId, parsed.data, signal), { headers });
  } catch (error) {
    const conflict = error instanceof Error && error.message === FEEDBACK_CONFLICT;

    return Response.json(
      {
        error: conflict
          ? FEEDBACK_CONFLICT
          : "Could not draft a note. Try again or write one yourself.",
      },
      {
        status: conflict ? 409 : 503,
        headers,
      }
    );
  }
}
