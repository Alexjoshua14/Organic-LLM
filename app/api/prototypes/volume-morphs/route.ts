import { auth } from "@clerk/nextjs/server";
import { generateText, Output } from "ai";
import { z } from "zod";

import { bounds, commandSchema } from "@/app/sandbox/prototypes/volume-morphs/scene";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { canSeeLabs } from "@/lib/admin/lab-access";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";
import { budgetModelId, createAuthenticatedLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { models } from "@/lib/schemas/chat-models";

const bodySchema = z.object({ message: z.string().trim().min(1).max(500) }).strict();
const operation = "/api/prototypes/volume-morphs";
const timeout = 6000;

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId || !(await canSeeLabs(userId))) {
    return Response.json({ error: "Lab access required." }, { status: 401 });
  }
  const body = bodySchema.safeParse(await request.json().catch(() => null));

  if (!body.success)
    return Response.json({ error: "Enter a command up to 500 characters." }, { status: 400 });

  const profile = await getSupabaseUserId(userId);

  if (profile.error || !profile.data)
    return Response.json({ error: "User not found." }, { status: 404 });
  const gate = await requirePlanBudget({ clerkUserId: userId, sbUserId: profile.data });

  if (gate) return gate;

  try {
    const model = models.google.flashLite_3_1.id;
    const { output } = await generateText({
      ...(await createAuthenticatedLlmBudgetHooks({ modelId: budgetModelId(model), operation })),
      model,
      instructions: `Translate one designer command into one place or move operation.
The sandbox bounds are ${bounds.w} by ${bounds.h} by ${bounds.thickness}. Coordinates are near-face origins.
Require explicit x and y (a coordinate pair also counts). Give unused fields null.
Use unsupported if the command cannot be expressed as a single operation. Never infer an existing piece ID.`,
      prompt: body.data.message,
      output: Output.object({ schema: commandSchema }),
      abortSignal: AbortSignal.timeout(timeout),
      maxOutputTokens: 512,
      providerOptions: { gateway: { zeroDataRetention: true } },
    });

    return Response.json(output, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "The designer could not interpret that command." },
      { status: 502 }
    );
  }
}
