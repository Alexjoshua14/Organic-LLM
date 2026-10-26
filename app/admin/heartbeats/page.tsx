import { notFound } from "next/navigation";

import { HeartbeatDashboard } from "./_components/HeartbeatDashboard";

import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = {
  title: "Heartbeats · Admin",
  robots: { index: false, follow: false },
};

export default async function HeartbeatsPage() {
  if (!(await requireAdmin())) notFound();

  return <HeartbeatDashboard />;
}
