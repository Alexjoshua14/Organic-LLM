import { appendUsageAdjustment, readUsageLedger } from "@/data/supabase/usage-ledger";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createUsageLedgerHandlers } from "@/lib/api/usage-ledger-handler";

const handlers = createUsageLedgerHandlers({
  requireAdmin,
  read: readUsageLedger,
  append: appendUsageAdjustment,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
