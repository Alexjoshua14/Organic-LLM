import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/spark/page.tsx");

export default async function SparkIndexPage() {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("SparkIndexPage", "Error creating chat");
    redirect("/sandbox");
  }

  const id = res.data;
  const path = `/sandbox/spark/${id}`;

  const routingRes = await updateThreadRouting(id, { feature: "spark", path });

  if (!routingRes.ok) {
    logger.error("SparkIndexPage", "Failed to set spark thread routing");
  }

  redirect(path);
}
