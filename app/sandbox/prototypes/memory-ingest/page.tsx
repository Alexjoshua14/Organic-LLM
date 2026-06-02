import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/prototypes/memory-ingest/page.tsx");

export default async function MemoryIngestNewPage() {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("MemoryIngestNewPage", "Error creating chat");
    redirect("/sandbox/prototypes");
  }

  redirect(`/sandbox/prototypes/memory-ingest/${res.data}`);
}
