import { notFound } from "next/navigation";

import { PrototypeAboutRouteOverlay } from "@/components/sandbox/PrototypeAboutRouteOverlay";
import { requireAdmin } from "@/lib/admin/require-admin";

export default async function PrototypesLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireAdmin())) notFound();

  return (
    <>
      {children}
      <PrototypeAboutRouteOverlay />
    </>
  );
}
