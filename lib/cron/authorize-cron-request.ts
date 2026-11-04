import { timingSafeEqual } from "crypto";

/** Constant-time string compare; false (no early-out) when lengths differ. */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) return false;

  return timingSafeEqual(aBytes, bBytes);
}

/**
 * Whether a request carries `Authorization: Bearer ${CRON_SECRET}` — what Vercel Cron sends, and
 * what the Supabase pg_cron jobs in `docs/migrations/` send. Closed when no secret is configured.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const header = request.headers.get("authorization");

  if (!header) return false;

  return safeEqual(header, `Bearer ${secret}`);
}
