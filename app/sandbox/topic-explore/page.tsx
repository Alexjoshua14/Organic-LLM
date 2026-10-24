import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/topic-explore/page.tsx");

export default async function TopicExploreIndexPage() {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("TopicExploreIndexPage", "Error creating chat");
    redirect("/sandbox");
  }

  const id = res.data;
  const path = `/sandbox/topic-explore/${id}`;

  const routingRes = await updateThreadRouting(id, { feature: "topic_explore", path });

  if (!routingRes.ok) {
    logger.error("TopicExploreIndexPage", "Failed to set topic explore thread routing");
  }

  redirect(path);
}
