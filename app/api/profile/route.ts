import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getProfile } from "@/data/supabase/profiles";
import { clientErrorJson, logRouteError } from "@/lib/api/client-safe-error";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/api/profile/route.ts");

/**
 * GET /api/profile
 *
 * Returns the authenticated user's Supabase profile row for settings UI.
 */
export async function GET() {
  const user = await auth();

  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getProfile(user.userId);

  if (result.error || !result.data) {
    if (result.error) {
      logRouteError(logger, "GET", result.error);
    }

    return clientErrorJson(404, "Profile not found");
  }

  return NextResponse.json({ data: result.data });
}
