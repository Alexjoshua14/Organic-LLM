import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/prototypes/line-list/page.tsx");

export default async function LineListNewPage() {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("LineListNewPage", "Error creating chat");
    redirect("/sandbox/prototypes");
  }

  redirect(`/sandbox/prototypes/line-list/${res.data}`);
}
