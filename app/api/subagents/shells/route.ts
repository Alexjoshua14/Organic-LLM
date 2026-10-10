import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { createHardSetShellThread } from "@/data/supabase/subagent-shells";
import { isAdminUser } from "@/lib/admin/read-admin-profile";
import { getHardSetSubagent } from "@/lib/llm/subagents/hard-set/registry";

export const maxDuration = 15;

const BodySchema = z.object({ agentId: z.string().min(1).max(128) });

/**
 * POST /api/subagents/shells — open a new shell thread for one hard-set subagent (Subagent lab).
 * Admin only: these are subagents in development.
 */
export async function POST(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdminUser(clerkUser.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));

  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const agent = getHardSetSubagent(body.data.agentId);

  if (!agent) return NextResponse.json({ error: "Unknown subagent" }, { status: 404 });

  const sbUserId = await getSupabaseUserId(clerkUser.userId);

  if (sbUserId.error || sbUserId.data === null) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const threadId = await createHardSetShellThread({ ownerId: sbUserId.data, agent });

  if (!threadId) return NextResponse.json({ error: "Could not open a shell" }, { status: 500 });

  return NextResponse.json({ threadId });
}
