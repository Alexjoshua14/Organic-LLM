import { TokenAnalyticsDashboard } from "./_components/TokenAnalyticsDashboard";

import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = { title: "Token usage · Admin" };

export default async function UsageLedgerPage() {
  const admin = await requireAdmin();

  if (!admin) return null;

  return <TokenAnalyticsDashboard ownerId={admin.sbUserId} />;
}
