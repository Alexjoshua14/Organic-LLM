import { notFound } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin/require-admin";

const SECTIONS = [
  { href: "/admin/errors", label: "Server errors" },
  { href: "/admin/memory-quality", label: "Memory quality" },
];

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
          <nav className="flex items-center gap-4">
            {SECTIONS.map((section) => (
              <Link
                key={section.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                href={section.href}
              >
                {section.label}
              </Link>
            ))}
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
