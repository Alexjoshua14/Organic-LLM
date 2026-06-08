import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { NextResponse } from "next/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import {
  ExportPromptRequestSchema,
  handleExportPromptPost,
} from "@/lib/export/handle-export-prompt-post";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";

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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = ExportPromptRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await handleExportPromptPost(parsed.data, sbUserId.data, {
    generateTextImpl: generateText,
    checkLlmMessageLimit,
  });

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json(result.body, { status: result.status });
}
