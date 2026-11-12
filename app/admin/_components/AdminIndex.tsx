import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";

import { glass } from "@/components/design-system/primitives";
import {
  ADMIN_GROUPS,
  ADMIN_PAGES,
  adminPagesInGroup,
  type AdminPage,
} from "@/lib/admin/admin-pages";
import { cn } from "@/lib/utils";

/**
 * The /admin landing page. The desktop and phone layouts are two separate trees, not one grid
 * that shrinks: desktop gives each group a left rail and large cards; phones get one inset list
 * per group with full-width 64px rows. Both read the same registry.
 */

const iconChip =
  "flex shrink-0 items-center justify-center rounded-xl border border-border/60 bg-foreground/5 text-foreground";

export function AdminIndex() {
  const count = ADMIN_PAGES.length;

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      <div className="md:pt-6">
        <p className="text-2xs uppercase tracking-wider text-muted-foreground">Admin</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-3xl">
          Operator dashboards
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {count} pages, visible only to admin accounts. Everything here reads aggregates or
          operational records; none of it is part of the product.
        </p>
      </div>

      <div className="hidden md:block">
        <DesktopGroups />
      </div>
      <div className="md:hidden">
        <PhoneGroups />
      </div>
    </div>
  );
}

function DesktopGroups() {
  return (
    <div className="mt-12 space-y-12">
      {ADMIN_GROUPS.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`admin-group-${group.id}-desktop`}
          className="grid grid-cols-[13rem_minmax(0,1fr)] gap-x-10"
        >
          <div>
            <h2 className="text-sm font-medium" id={`admin-group-${group.id}-desktop`}>
              {group.title}
            </h2>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{group.note}</p>
          </div>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {adminPagesInGroup(group.id).map((page) => (
              <li key={page.slug}>
                <DesktopCard page={page} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DesktopCard({ page }: { page: AdminPage }) {
  const Icon = page.icon;

  return (
    <Link
      href={page.href}
      className={cn(
        glass(),
        "organic-focus group flex h-full min-h-40 flex-col rounded-2xl p-5",
        "transition-[transform,background-color,border-color] duration-150",
        "hover:border-foreground/25 hover:bg-background/50",
        "motion-safe:hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn(iconChip, "size-11")}>
          <Icon aria-hidden className="size-5" strokeWidth={1.6} />
        </span>
        <ArrowUpRight
          aria-hidden
          className="size-4 text-muted-foreground transition-[transform,color] duration-150 group-hover:text-foreground motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
        />
      </div>
      <h3 className="mt-5 text-base font-medium">{page.title}</h3>
      <p className="mt-1 text-sm leading-snug text-muted-foreground">{page.blurb}</p>
      <p className="mt-auto pt-4 font-mono text-2xs text-muted-foreground/80">{page.href}</p>
    </Link>
  );
}

function PhoneGroups() {
  return (
    <div className="mt-8 space-y-7">
      {ADMIN_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`admin-group-${group.id}-phone`}>
          <h2
            className="px-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground"
            id={`admin-group-${group.id}-phone`}
          >
            {group.title}
          </h2>
          <ul className={cn(glass({ opaque: true }), "mt-2 divide-y divide-border/50 rounded-2xl")}>
            {adminPagesInGroup(group.id).map((page) => (
              <li key={page.slug}>
                <PhoneRow page={page} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PhoneRow({ page }: { page: AdminPage }) {
  const Icon = page.icon;

  return (
    <Link
      href={page.href}
      className="organic-focus flex min-h-16 items-center gap-3 px-3.5 py-3 transition-colors active:bg-foreground/5"
    >
      <span className={cn(iconChip, "size-10")}>
        <Icon aria-hidden className="size-[18px]" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-tight">{page.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
          {page.blurb}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
