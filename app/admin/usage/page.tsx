import { requireAdmin } from "@/lib/admin/require-admin";
import { UsageLedgerDashboard } from "./_components/UsageLedgerDashboard";

export const metadata = { title: "Usage ledger · Admin" };

export default async function UsageLedgerPage() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return <UsageLedgerDashboard initialOwnerId={admin.sbUserId} />;
}
