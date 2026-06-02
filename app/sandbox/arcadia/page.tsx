import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/arcadia/page.tsx");

export default async function ArcadiaIndexPage() {
  const res = await createChat();

  if (res.error || res.data === null) {
    logger.error("ArcadiaIndexPage", "Error creating chat");
    redirect("/sandbox");
  }

  const id = res.data;
  const path = `/sandbox/arcadia/${id}`;

  const routingRes = await updateThreadRouting(id, { feature: "arcadia", path });

  if (!routingRes.ok) {
    logger.error("ArcadiaIndexPage", "Failed to set Arcadia thread routing");
  }

  redirect(path);
}
