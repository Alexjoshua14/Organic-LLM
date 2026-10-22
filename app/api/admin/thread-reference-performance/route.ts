import { requireAdmin } from "@/lib/admin/require-admin";
import { threadReferenceMetrics } from "@/lib/chat/thread-reference-metrics";

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json({ scope: "Current server instance; resets on restart. Latest 512 samples per operation.", data: threadReferenceMetrics.snapshot() }, { headers: { "Cache-Control": "no-store" } });
}
