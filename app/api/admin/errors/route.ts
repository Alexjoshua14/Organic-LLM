import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import {
  SERVER_ERROR_LOG_LIMIT,
  clearServerErrorReports,
  isErrorStoreRedisConfigured,
  listServerErrorReports,
} from "@/lib/observability/error-store";
import { SERVER_ERROR_LOG_TAG } from "@/lib/observability/server-error";

export const dynamic = "force-dynamic";

/** Recent server errors (newest first) for the /admin/errors dashboard. */
export async function GET(req: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Number.parseInt(limitParam ?? "", 10);
  const { reports, source } = await listServerErrorReports(
    Number.isFinite(limit) ? limit : SERVER_ERROR_LOG_LIMIT
  );

  return NextResponse.json({
    reports,
    source,
    redisConfigured: isErrorStoreRedisConfigured(),
    limit: SERVER_ERROR_LOG_LIMIT,
    logTag: SERVER_ERROR_LOG_TAG,
  });
}

export async function DELETE() {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await clearServerErrorReports();

  return NextResponse.json({ cleared: true });
}
