import { notFound } from "next/navigation";

import { requireLabAccess } from "@/lib/admin/lab-access";

/**
 * Unfinished surfaces (labs, prototypes, internal dashboards) are for admins and agent test
 * accounts only, so invited testers see only finished pieces. A layout runs on the server
 * whenever navigation enters its subtree, so client-side links cannot skip the check.
 * Re-export it as a segment layout.
 */
export default async function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireLabAccess())) notFound();

  return children;
}
