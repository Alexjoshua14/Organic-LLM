import { requireAdmin } from "@/lib/admin/require-admin";
import { getThreadReferenceMetricsSnapshot } from "@/lib/chat/thread-reference-metrics-server";

export const metadata = { title: "Thread performance · Admin" };

export default async function ThreadReferencePerformancePage() {
  if (!(await requireAdmin())) return null;
  let data;
  try {
    data = await getThreadReferenceMetricsSnapshot();
  } catch {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <h1 className="text-xl font-medium">Thread reference performance</h1>
        <p role="status" className="text-sm text-foreground-secondary">
          Shared telemetry is currently unavailable.
        </p>
      </main>
    );
  }
  const ms = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)} ms`);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-medium">Thread reference performance</h1>
      <p className="text-sm text-foreground-secondary">
        Shared across server instances. Latest 512 timings per operation, retained for up to 30
        days. Empty cells mean no observed requests. Refresh to update.
      </p>
      <div className="overflow-x-auto rounded-lg border border-default-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Operation", "Observed", "Samples", "p50", "p95", "p99"].map((label) => (
                <th key={label} className="p-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.operation} className="border-t border-default-200">
                <td className="p-3">{row.operation}</td>
                <td className="p-3">{row.total}</td>
                <td className="p-3">{row.samples}</td>
                <td className="p-3">{ms(row.p50)}</td>
                <td className="p-3">{ms(row.p95)}</td>
                <td className="p-3">{ms(row.p99)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-foreground-secondary">
        Resolve includes ownership checks and any label generation. Cache timings measure through
        cache lookup. Clipboard timings are server persistence only. No content or user identifiers
        are recorded.
      </p>
    </main>
  );
}
