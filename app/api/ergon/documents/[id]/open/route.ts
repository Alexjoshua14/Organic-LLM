import { auth } from "@clerk/nextjs/server";

import { getErgonDocument } from "@/data/supabase/ergon-documents";
import { saveChat } from "@/lib/chat/chat-store";
import { buildOpenDocumentMessage } from "@/lib/ergon-documents/open-message";
import { OpenErgonDocumentRequestSchema } from "@/lib/schemas/ergon-documents";
import { toErgonDocumentSummary } from "@/lib/schemas/ergon-documents";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = OpenErgonDocumentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await params;
  const document = await getErgonDocument(id);

  if (!document || document.thread_id !== parsed.data.chatId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const message = buildOpenDocumentMessage({
    messageId: parsed.data.messageId,
    toolCallId: parsed.data.toolCallId,
    document: toErgonDocumentSummary(document),
  });

  const saveResult = await saveChat({
    chatId: parsed.data.chatId,
    messages: [message],
  });

  if (!saveResult.ok) {
    return Response.json({ error: "Failed to persist message" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
