import { requireAdmin } from "@/lib/admin/require-admin";
import { getThreadReferenceMetricsSnapshot } from "@/lib/chat/thread-reference-metrics-server";

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  try {
    const data = await getThreadReferenceMetricsSnapshot();
    return Response.json(
      {
        scope:
          "Shared across server instances; latest 512 timings per operation, retained for up to 30 days.",
        data,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { error: "Shared telemetry is currently unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
