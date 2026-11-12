"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { type PointerEvent } from "react";

import { AdminArt } from "./AdminArt";
import styles from "./AdminIndex.module.css";

import { ADMIN_GROUPS, ADMIN_PAGES } from "@/lib/admin/admin-pages";
import { cn } from "@/lib/utils";

type AdminCardProps = {
  slug: string;
  layout: "desktop" | "phone";
  /** The one large card per layout. */
  feature?: boolean;
  /** Phone only: a full-width row instead of a half-width tile. */
  wide?: boolean;
  /** Position in the grid: staggers the entrance. */
  index: number;
  className?: string;
};

/**
 * One admin page as a glass card. The Lumen spotlight tracks the pointer by writing two CSS
 * variables on the element: no state, no re-render, nothing to do on touch. Only the page's slug
 * crosses from the server; the card looks the rest up, so no component or function has to be
 * serialized.
 */
export function AdminCard({ slug, layout, feature, wide, index, className }: AdminCardProps) {
  const page = ADMIN_PAGES.find((p) => p.slug === slug);

  if (!page) return null;

  const group = ADMIN_GROUPS.find((g) => g.id === page.group);
  const onPointerMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const box = e.currentTarget.getBoundingClientRect();

    e.currentTarget.style.setProperty("--mx", `${e.clientX - box.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - box.top}px`);
  };

  return (
    <Link
      href={page.href}
      style={{ ["--i" as string]: index }}
      className={cn(
        styles.card,
        styles.rise,
        "organic-focus",
        layout === "phone" ? styles.cardPhone : feature ? styles.cardFeature : styles.cardDesktop,
        layout === "phone" && wide && styles.cardPhoneWide,
        className
      )}
      onPointerMove={onPointerMove}
    >
      <span className={styles.top}>
        <span className={styles.tag}>{group?.title}</span>
        {layout === "desktop" ? <ArrowUpRight aria-hidden className={styles.arrow} /> : null}
      </span>
      <AdminArt slug={page.slug} />
      <span className={styles.body}>
        <span className={styles.title}>{page.title}</span>
        <span className={styles.blurb}>{page.blurb}</span>
      </span>
    </Link>
  );
}
