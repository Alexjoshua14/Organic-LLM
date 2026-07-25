import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { generateDmzIntakeSummary } from "@/lib/llm/dmz-intake-summary";
import { DMZ_CONNECTION_PROVIDERS } from "@/lib/security/dmz";

const BodySchema = z.object({
  excerpt: z.string().min(1).max(50_000),
  subjectKey: z.string().min(1).max(128),
  provider: z.enum(DMZ_CONNECTION_PROVIDERS),
});

export const maxDuration = 20;

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await generateDmzIntakeSummary({
    excerpt: parsed.data.excerpt,
    subjectKey: parsed.data.subjectKey,
    provider: parsed.data.provider,
  });

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error?.message ?? "Summary failed" }, { status: 500 });
  }

  return NextResponse.json({ summary: result.data });
}
