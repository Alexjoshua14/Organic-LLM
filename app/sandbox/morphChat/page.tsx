import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/morphChat/page.tsx");

export default async function MorphChatIndexPage() {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("MorphChatIndexPage", "Error creating chat");
    redirect("/sandbox");
  }

  const id = res.data;
  const path = `/sandbox/morphChat/${id}`;

  const routingRes = await updateThreadRouting(id, { feature: "morph_chat", path });

  if (!routingRes.ok) {
    logger.error("MorphChatIndexPage", "Failed to set morph chat thread routing");
  }

  redirect(path);
}
