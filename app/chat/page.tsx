import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/chat/page.tsx");

export default async function ChatPage() {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("handleNewChat", "Error creating chat");

    redirect("/");
  }

  const id = res.data;

  redirect(`/chat/${id}`);
}
