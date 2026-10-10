import { redirect } from "next/navigation";

import { createChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";
import { PERF_PHASES } from "@/lib/perf/journeys";
import { stashServerPhases, timeServerPhase } from "@/lib/perf/server-phase";

const logger = createLogger("app/sandbox/arcadia/page.tsx");

export default async function ArcadiaIndexPage() {
  const phases: Array<{ name: string; ms: number }> = [];

  const res = await timeServerPhase(phases, PERF_PHASES.serverCreateChat, () =>
    createChat("arcadia")
  );

  if (res.error || res.data === null) {
    logger.error("ArcadiaIndexPage", "Error creating chat");
    redirect("/sandbox");
  }

  const id = res.data;
  const path = `/sandbox/arcadia/${id}`;

  stashServerPhases(id, phases);
  redirect(path);
}
