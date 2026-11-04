import type { AdminContext } from "@/lib/admin/require-admin";

import { z } from "zod";

import {
  HEARTBEAT_STATUSES,
  HeartbeatDashboardSchema,
  type HeartbeatDashboardQuery,
} from "@/lib/admin/heartbeat-telemetry";

const QuerySchema = z
  .object({
    hours: z.enum(["1", "24", "168"]).default("24"),
    status: z.enum(["all", ...HEARTBEAT_STATUSES]).default("all"),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    until: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

export function createHeartbeatTelemetryHandler(deps: {
  requireAdmin(): Promise<AdminContext | null>;
  read(query: HeartbeatDashboardQuery): Promise<unknown>;
  now?: () => number;
}) {
  return async (req: Request) => {
    if (!(await deps.requireAdmin())) return json({ error: "Forbidden" }, 403);
    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));

    if (!parsed.success) return json({ error: "Invalid telemetry query" }, 400);
    const now = (deps.now ?? Date.now)();
    const until = parsed.data.until ?? new Date(now).toISOString();

    // Keep the dashboard inside raw retention, including anchored pagination.
    if (Date.parse(until) > now + 60_000 || Date.parse(until) < now - 24 * 60 * 60_000) {
      return json({ error: "Refresh the telemetry window" }, 400);
    }
    const query = { ...parsed.data, hours: Number(parsed.data.hours), until };

    try {
      const data = HeartbeatDashboardSchema.parse(await deps.read(query));

      return json({ ...data, ...query });
    } catch {
      return json(
        { error: "Heartbeat telemetry unavailable. Check the telemetry migrations and retry." },
        503
      );
    }
  };
}
