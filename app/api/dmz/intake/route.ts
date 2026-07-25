import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  DMZ_CONNECTION_PROVIDERS,
  intakeDmzIntelligence,
} from "@/lib/security/dmz";

const IntakeSchema = z.object({
  provider: z.enum(DMZ_CONNECTION_PROVIDERS),
  subjectKey: z.string().min(1).max(128),
  text: z.string().min(1).max(50_000),
  intakeSummary: z.string().max(500).optional(),
  clipboardMeta: z
    .object({
      charCount: z.number().int().nonnegative(),
      lineCount: z.number().int().nonnegative(),
      estimatedTokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserId = await getSupabaseUserId(user.userId);

  if (sbUserId.error || !sbUserId.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = IntakeSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { entry, alert, canAutoApprove } = intakeDmzIntelligence(sbUserId.data, parsed.data);

  return NextResponse.json({
    entry: {
      id: entry.id,
      provider: entry.provider,
      subjectKey: entry.subjectKey,
      status: entry.status,
      createdAt: entry.createdAt,
      findings: entry.scan.findings,
      intakeSummary: entry.intakeSummary,
      clipboardMeta: entry.clipboardMeta,
    },
    alert: alert ?? null,
    canAutoApprove,
  });
}
