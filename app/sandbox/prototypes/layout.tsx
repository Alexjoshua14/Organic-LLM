import { notFound } from "next/navigation";

import { PrototypeAboutRouteOverlay } from "@/components/sandbox/PrototypeAboutRouteOverlay";
import { requireLabAccess } from "@/lib/admin/lab-access";

export default async function PrototypesLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireLabAccess())) notFound();

  return (
    <>
      {children}
      <PrototypeAboutRouteOverlay />
    </>
  );
}
