import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminNav } from "./_components/AdminNav";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { requireAdmin } from "@/lib/admin/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  if (!admin) {
    notFound();
  }

  // The same canvas as the other internal gateway (/sandbox): the app's page chrome, its liquid
  // chrome backdrop, and content layered above it. Not a flat opaque panel.
  return (
    <LiquidChromePage transparentBackground className="items-stretch justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 flex h-full min-h-0 w-full flex-col text-foreground">
        {/*
          The app draws its own controls over this page: the sidebar trigger at the top left (about
          5rem on phones, 3.5rem from md up) and the control cluster at the top right (9.5rem wide,
          3.5rem tall). Row one keeps the title between them; the page links sit in a second row so
          they never run underneath the cluster, whatever the width.
        */}
        <header className="shrink-0 border-b border-border/60 pt-[env(safe-area-inset-top,0px)]">
          <div className="mx-auto flex min-h-14 max-w-6xl items-center pr-[10.5rem] pl-[5.25rem] md:pl-16">
            <Link className="organic-focus -mx-1 rounded-md px-1" href="/admin">
              <p className="text-2xs uppercase tracking-wider text-muted-foreground">Admin</p>
              <p className="font-commissioner text-sm font-light tracking-tight">
                Operator dashboards
              </p>
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
    </LiquidChromePage>
  );
}
