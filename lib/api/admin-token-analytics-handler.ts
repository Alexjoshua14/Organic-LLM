import type { AdminContext } from "@/lib/admin/require-admin";
import type { TokenBucket } from "@/lib/usage/token-analytics";

export function createTokenAnalyticsHandler(deps: {
  requireAdmin(): Promise<AdminContext | null>;
  read(owner: string, start: string, end: string): Promise<TokenBucket[]>;
  now?: () => Date;
}) {
  return async (req: Request) => {
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    const admin = await deps.requireAdmin();

    if (!admin) return json({ error: "Forbidden" }, 403);
    const params = new URL(req.url).searchParams;
    const days = params.get("days") ?? "30";

    if (
      !["7", "30", "90"].includes(days) ||
      Array.from(params.keys()).some((key) => key !== "days")
    ) {
      return json({ error: "Invalid analytics query" }, 400);
    }
    const end = (deps.now?.() ?? new Date()).toISOString();
    const startDate = new Date(end);

    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - Number(days) + 1);
    const start = startDate.toISOString();

    try {
      return json({ start, end, rows: await deps.read(admin.sbUserId, start, end) });
    } catch {
      return json(
        {
          error:
            "Token analytics unavailable. Check that the analytics migration has been applied.",
        },
        503
      );
    }
  };
}
