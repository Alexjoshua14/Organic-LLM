import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { clientErrorJson, logRouteError } from "@/lib/api/client-safe-error";
import { loadHomepageRoutingCandidates } from "@/lib/chat/load-homepage-routing-candidates";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/api/launcher/candidates/route.ts");

/**
 * GET /api/launcher/candidates?coalescence=true|false
 * Returns reopen targets for the Cmd+K launcher (threads, optional rabbit holes, Strata pages).
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("coalescence");
  const coalescenceMode = raw === "true" || raw === "1";

  const res = await loadHomepageRoutingCandidates(coalescenceMode);

  if (res.error) {
    logRouteError(logger, "GET", res.error);

    return clientErrorJson(500);
  }

  return NextResponse.json({ data: res.data ?? [] });
}
