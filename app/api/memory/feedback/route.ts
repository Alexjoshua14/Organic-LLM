import { z } from "zod";

import { listFeedback, readFeedback, resolveFeedbackUser } from "@/lib/memory/feedback";

const QuerySchema = z.object({
  memoryId: z.string().min(1).max(256).optional(),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const userId = await resolveFeedbackUser();

    if (!userId) return Response.json({ error: "Not signed in" }, { status: 401, headers });
    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

    if (!parsed.success)
      return Response.json({ error: "Invalid request" }, { status: 400, headers });
    const { memoryId, offset } = parsed.data;
    const data = memoryId
      ? { row: await readFeedback(userId, memoryId) }
      : await listFeedback(userId, offset, 20);

    return Response.json(data, { headers });
  } catch {
    return Response.json(
      { error: "Feedback is unavailable. Please try again." },
      { status: 503, headers }
    );
  }
}
