import {
  Activity,
  BarChart3,
  Brain,
  Gauge,
  HeartPulse,
  MailPlus,
  type LucideIcon,
} from "lucide-react";

/**
 * Every page under `app/admin`, in one list. The /admin index and the admin header nav both read
 * this, so a new page shows up in both by adding one entry here (a test keeps the list equal to
 * the folders on disk).
 */

export type AdminPageGroup = "insight" | "operations" | "access";

export type AdminPage = {
  /** Folder name under `app/admin`. */
  slug: string;
  href: string;
  title: string;
  /** One sentence, written for the card. */
  blurb: string;
  group: AdminPageGroup;
  icon: LucideIcon;
};

export const ADMIN_GROUPS: readonly { id: AdminPageGroup; title: string; note: string }[] = [
  { id: "insight", title: "Insight", note: "How the app is performing and what it remembers." },
  { id: "operations", title: "Operations", note: "Spend and background activity." },
  { id: "access", title: "Access", note: "Who can get in." },
];

export const ADMIN_PAGES: readonly AdminPage[] = [
  {
    slug: "performance",
    href: "/admin/performance",
    title: "Performance",
    blurb: "Anonymous timings against the 250 ms budget, by action, page and device.",
    group: "insight",
    icon: Gauge,
  },
  {
    slug: "thread-reference-performance",
    href: "/admin/thread-reference-performance",
    title: "Thread performance",
    blurb: "Server timings for thread reads and references. Latest 512 per operation.",
    group: "insight",
    icon: Activity,
  },
  {
    slug: "memory-quality",
    href: "/admin/memory-quality",
    title: "Memory quality",
    blurb: "Ingest trends, eval runs, votes and approved notes.",
    group: "insight",
    icon: Brain,
  },
  {
    slug: "usage",
    href: "/admin/usage",
    title: "Usage ledger",
    blurb: "Original charges and admin adjustments. Entries are never edited or deleted.",
    group: "operations",
    icon: BarChart3,
  },
  {
    slug: "heartbeats",
    href: "/admin/heartbeats",
    title: "Heartbeats",
    blurb: "Observed multiagent heartbeat polls across all accounts.",
    group: "operations",
    icon: HeartPulse,
  },
  {
    slug: "invites",
    href: "/admin/invites",
    title: "Invites",
    blurb: "Invite people onto the free plan and see which invitations are still open.",
    group: "access",
    icon: MailPlus,
  },
];

export function adminPagesInGroup(group: AdminPageGroup): AdminPage[] {
  return ADMIN_PAGES.filter((page) => page.group === group);
}

/** The page whose route contains `pathname`, for the header's current-page cue. */
export function adminPageForPath(pathname: string): AdminPage | undefined {
  return ADMIN_PAGES.find((page) => pathname === page.href || pathname.startsWith(`${page.href}/`));
}
