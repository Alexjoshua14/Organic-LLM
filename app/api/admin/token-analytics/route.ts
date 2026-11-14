import { readTokenAnalytics } from "@/data/supabase/token-analytics";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createTokenAnalyticsHandler } from "@/lib/api/admin-token-analytics-handler";

export const GET = createTokenAnalyticsHandler({ requireAdmin, read: readTokenAnalytics });
