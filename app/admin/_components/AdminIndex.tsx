import { AdminCard } from "./AdminCard";
import styles from "./AdminIndex.module.css";

import { ADMIN_PAGES } from "@/lib/admin/admin-pages";
import { cn } from "@/lib/utils";

/**
 * The /admin landing page. Desktop and phone are two separate layouts over the same registry, not
 * one grid that shrinks. Desktop is a bento: one featured card (the first page) beside a few
 * wider ones, then an even row. A page added to the registry lands as a regular card in both,
 * so nothing here needs to change for it to appear.
 */

/** Desktop column spans on the 12-column grid (from `lg`; two equal columns below it). */
const DESKTOP_SPAN: Record<string, string> = {
  performance: "col-span-2 lg:col-span-7 lg:row-span-2",
  "thread-reference-performance": "lg:col-span-5",
  "memory-quality": "lg:col-span-5",
};
const DESKTOP_DEFAULT_SPAN = "lg:col-span-4";

/** The phone feature spans both columns; so does the last card when it would sit alone. */
const PHONE_FEATURE = "performance";

export function AdminIndex() {
  const pages = ADMIN_PAGES;
  const phoneRest = pages.filter((p) => p.slug !== PHONE_FEATURE);
  const lastAlone = phoneRest.length % 2 === 1 ? phoneRest[phoneRest.length - 1]?.slug : undefined;

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Admin pages</h1>

      <div className="hidden md:block">
        <ul className={cn(styles.grid, styles.gridDesktop)}>
          {pages.map((page, i) => (
            <li
              key={page.slug}
              className={cn("flex", DESKTOP_SPAN[page.slug] ?? DESKTOP_DEFAULT_SPAN)}
            >
              <AdminCard
                className="w-full"
                feature={page.slug === PHONE_FEATURE}
                index={i}
                layout="desktop"
                slug={page.slug}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="md:hidden">
        <ul className={cn(styles.grid, styles.gridPhone)}>
          {pages.map((page, i) => {
            const span2 = page.slug === PHONE_FEATURE || page.slug === lastAlone;

            return (
              <li key={page.slug} className={cn("flex", span2 && "col-span-2")}>
                <AdminCard
                  className="w-full"
                  feature={page.slug === PHONE_FEATURE}
                  index={i}
                  layout="phone"
                  slug={page.slug}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
