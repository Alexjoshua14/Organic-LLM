import { notFound } from "next/navigation";

import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";
import { requireAdmin } from "@/lib/admin/require-admin";

export default async function StatusLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireAdmin())) notFound();

  return (
    <>
      <LiquidChromeSsrFill id="status-liquid-chrome-ssr-fill" />
      {children}
    </>
  );
}
