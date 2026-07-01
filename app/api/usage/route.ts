import type { UsageRangePreset } from "@/lib/usage/aggregate";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { buildUsageSummaryForUser } from "@/data/supabase/llm-usage";
import { getSupabaseUserId } from "@/data/supabase/profiles";

const VALID_PRESETS = new Set<UsageRangePreset>(["7d", "30d", "90d"]);

export async function GET(req: Request) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || !sbUserIdResult.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const rawPreset = searchParams.get("range") ?? "30d";
  const preset = VALID_PRESETS.has(rawPreset as UsageRangePreset)
    ? (rawPreset as UsageRangePreset)
    : "30d";

  const summary = await buildUsageSummaryForUser({
    ownerId: sbUserIdResult.data,
    preset,
  });

  return NextResponse.json(summary);
}
