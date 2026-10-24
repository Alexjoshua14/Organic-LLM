import { UsageLedgerDashboard } from "./_components/UsageLedgerDashboard";

import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = { title: "Usage ledger · Admin" };

export default async function UsageLedgerPage() {
  const admin = await requireAdmin();

  if (!admin) return null;

  return <UsageLedgerDashboard initialOwnerId={admin.sbUserId} />;
}
