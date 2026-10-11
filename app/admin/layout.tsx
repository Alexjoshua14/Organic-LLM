import { notFound } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  if (!admin) {
    notFound();
  }

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-2xs uppercase tracking-wider text-muted-foreground">Admin</p>
            <h1 className="text-sm font-medium">Operator dashboards</h1>
          </div>
          <nav
            aria-label="Admin"
            className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
          >
            <Link className="hover:text-foreground" href="/admin/usage">
              Usage ledger
            </Link>
            <Link
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              href="/"
            >
              Back to app
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
