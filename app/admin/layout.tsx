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
      {/*
        The app draws its own controls over this page: the sidebar trigger at the top left (about
        5rem on phones, 3.5rem from md up) and the control cluster at the top right (9.5rem wide,
        3.5rem tall). Row one keeps the title between them; the page links sit in a second row so
        they never run underneath the cluster, whatever the width.
      */}
      <header className="shrink-0 border-b border-border pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center pr-[10.5rem] pl-[5.25rem] md:pl-16">
          <Link className="organic-focus -mx-1 rounded-md px-1" href="/admin">
            <p className="text-2xs uppercase tracking-wider text-muted-foreground">Admin</p>
            <p className="text-sm font-medium">Operator dashboards</p>
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <AdminNav />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
