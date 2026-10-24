import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildDmzCursorInstruction,
  buildDmzNotionPastebackGuide,
  buildDmzObsidianPastebackGuide,
  buildDmzOutboundQuestion,
  DMZ_CONNECTION_PROVIDERS,
  getDmzConnection,
} from "@/lib/security/dmz";

const OutboundSchema = z.object({
  provider: z.enum(DMZ_CONNECTION_PROVIDERS),
  subjectKey: z.string().min(1).max(128),
  subjectTitle: z.string().min(1).max(256),
  question: z.string().min(1).max(4000),
  context: z.string().max(10_000).optional(),
});

export async function POST(req: Request) {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = OutboundSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const connection = getDmzConnection(parsed.data.provider);

  if (!connection) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const base = {
    subjectKey: parsed.data.subjectKey,
    subjectTitle: parsed.data.subjectTitle,
    question: parsed.data.question,
    context: parsed.data.context,
  };

  let prompt: string;
  let mode: "open_in_chat" | "clipboard" | "pasteback_guide" = "clipboard";

  if (connection.id === "notion") {
    prompt = buildDmzNotionPastebackGuide(base);
    mode = "pasteback_guide";
  } else if (connection.id === "obsidian") {
    prompt = buildDmzObsidianPastebackGuide(base);
    mode = "pasteback_guide";
  } else if (connection.id === "cursor") {
    prompt = buildDmzCursorInstruction(base);
    mode = "clipboard";
  } else {
    prompt = buildDmzOutboundQuestion(base);
    mode = connection.supportsOpenIn ? "open_in_chat" : "clipboard";
  }

  return NextResponse.json({
    provider: connection.id,
    label: connection.label,
    mode,
    openInProvider: connection.openInProvider ?? null,
    prompt,
    supportsPasteback: connection.supportsPasteback,
  });
}
