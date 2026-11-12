import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "./_components/AdminNav";

import { requireAdmin } from "@/lib/admin/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  if (!admin) {
    notFound();
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 md:py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link className="organic-focus -mx-1 rounded-md px-1" href="/admin">
            <p className="text-2xs uppercase tracking-wider text-muted-foreground">Admin</p>
            <p className="text-sm font-medium">Operator dashboards</p>
          </Link>
          <AdminNav />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
