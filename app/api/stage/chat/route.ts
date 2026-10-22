import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { NextResponse } from "next/server";

import { createChat } from "@/data/supabase/chat";
import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { loadChat } from "@/lib/chat/chat-store";
import { checkStageLimit } from "@/lib/stage/limit";
import { readStage } from "@/lib/stage/store";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const profile = await getSupabaseUserIdCached(userId);
    if (profile.error || !profile.data) return json({ error: "User not found" }, 404);
    if (!(await checkStageLimit(profile.data))) return json({ error: "Too many requests" }, 429);
    const widgetId = new URL(req.url).searchParams.get("widgetId");
    if (!z.string().uuid().safeParse(widgetId).success) return json({ error: "Invalid widget ID" }, 400);
    const { state } = await readStage(profile.data);
    const widget = state.widgets.find((item) => item.id === widgetId);
    if (!widget || widget.kind !== "chat") return json({ error: "Chat widget not found" }, 404);
    let loaded = await loadChat(widget.threadId);
    if (!loaded.data) {
      // The encrypted, committed widget owns this server-minted stable identity. Concurrent
      // hydration inserts may race; reload after either insert result, never replace a thread.
      await createChat(widget.threadId);
      loaded = await loadChat(widget.threadId);
    }
    if (loaded.error || !loaded.data || loaded.data.thread.owner_id !== profile.data) return json({ error: "Chat not found" }, 404);
    return json({ chatData: loaded.data });
  } catch { return json({ error: "Could not load chat" }, 500); }
}
