import { InvitesDashboard } from "./_components/InvitesDashboard";

import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = { title: "Invites · Admin" };

export default async function InvitesPage() {
  const admin = await requireAdmin();

  if (!admin) return null;

  return <InvitesDashboard />;
}
