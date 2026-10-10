import { auth } from "@clerk/nextjs/server";
import { consumeUsageReset } from "@/data/supabase/account-entitlements";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";
import { createUsageResetHandler } from "@/lib/api/usage-reset-handler";

export const POST = createUsageResetHandler({
  auth,
  getSupabaseUserId,
  consumeUsageReset,
  getPlanBudgetForUser,
});
