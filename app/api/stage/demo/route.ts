import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { routeStageDemo } from "@/lib/stage/demo/router";
import { STAGE_DEMO_SCENES } from "@/lib/stage/demo/scenes";
import { canSeeLabs } from "@/lib/admin/lab-access";

const Body = z
  .object({
    message: z.string().trim().min(1).max(500),
    current: z.enum(STAGE_DEMO_SCENES.map((scene) => scene.id) as [string, ...string[]]),
  })
  .strict();

/** Demo only: chooses a prebuilt scene for a message. Reads and writes no real Stage data. */
export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId || !(await canSeeLabs(userId)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));

  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  return NextResponse.json(
    { scene: await routeStageDemo(body.data.message, body.data.current) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
