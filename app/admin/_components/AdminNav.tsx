"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_PAGES, adminPageForPath } from "@/lib/admin/admin-pages";
import { cn } from "@/lib/utils";

/**
 * Admin header navigation. Two separate layouts: a full link row from `md` up, and on phones a
 * single "back to all pages" control that names the page you are on (seven links would wrap).
 */
export function AdminNav() {
  const pathname = usePathname() ?? "";
  const current = adminPageForPath(pathname);

  return (
    <>
      <nav aria-label="Admin" className="hidden items-center gap-1 text-xs md:flex">
        {ADMIN_PAGES.map((page) => {
          const active = current?.slug === page.slug;

          return (
            <Link
              key={page.slug}
              aria-current={active ? "page" : undefined}
              href={page.href}
              className={cn(
                "organic-focus rounded-md px-2.5 py-1.5 transition-colors",
                active
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {page.title}
            </Link>
          );
        })}
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <Link
          className="organic-focus rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          Back to app
        </Link>
      </nav>

      <nav aria-label="Admin" className="flex items-center gap-1 md:hidden">
        {current ? (
          <Link
            className="organic-focus -ml-2 flex min-h-11 items-center gap-1 rounded-md pr-2 pl-1 text-sm text-muted-foreground"
            href="/admin"
          >
            <ChevronLeft aria-hidden className="size-4" />
            All pages
          </Link>
        ) : (
          <Link
            className="organic-focus flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground"
            href="/"
          >
            Back to app
          </Link>
        )}
      </nav>
    </>
  );
}
