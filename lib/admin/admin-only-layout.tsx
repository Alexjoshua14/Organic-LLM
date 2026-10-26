import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * Unfinished surfaces (labs, prototypes, internal dashboards) are admin-only, so invited
 * testers see only finished pieces. A layout runs on the server whenever navigation enters
 * its subtree, so client-side links cannot skip the check. Re-export it as a segment layout.
 */
export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireAdmin())) notFound();

  return children;
}
