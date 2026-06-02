import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getShowSandboxGateway } from "@/data/supabase/profiles";
import { runHealthChecks } from "@/lib/health/run-health-checks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await getShowSandboxGateway(userId);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") !== "0";

  const report = await runHealthChecks({ deep });

  return NextResponse.json(report);
}
