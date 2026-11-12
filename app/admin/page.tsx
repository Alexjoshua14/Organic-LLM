import { notFound } from "next/navigation";

import { AdminIndex } from "./_components/AdminIndex";

import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = { title: "Admin" };

// The layout also gates, but a page must not rely on a parent for its own access check.
export default async function AdminIndexPage() {
  if (!(await requireAdmin())) notFound();

  return <AdminIndex />;
}
