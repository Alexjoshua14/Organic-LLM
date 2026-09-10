import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { updateThreadRouting } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { PERF_PHASES } from "@/lib/perf/journeys";
import { stashServerPhases, timeServerPhase } from "@/lib/perf/server-phase";

const logger = createLogger("app/sandbox/arcadia/page.tsx");

export default async function ArcadiaIndexPage() {
  const phases: Array<{ name: string; ms: number }> = [];

  const res = await timeServerPhase(phases, PERF_PHASES.serverCreateChat, () => createChat());

  if (res.error || res.data === null) {
    logger.error("ArcadiaIndexPage", "Error creating chat");
    redirect("/sandbox");
  }

  const id = res.data;
  const path = `/sandbox/arcadia/${id}`;

  const routingRes = await timeServerPhase(phases, PERF_PHASES.serverUpdateThreadRouting, () =>
    updateThreadRouting(id, { feature: "arcadia", path })
  );

  if (!routingRes.ok) {
    logger.error("ArcadiaIndexPage", "Failed to set Arcadia thread routing");
  }

  stashServerPhases(id, phases);
  redirect(path);
}
