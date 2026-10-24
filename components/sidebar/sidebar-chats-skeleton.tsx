import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from "../third-party/ui/sidebar";

import { cn } from "@/lib/utils";

/**
 * Timing for the thread-list placeholder. A slow, low-contrast pulse reads as "arriving",
 * not "working"; the stagger keeps rows from blinking in unison. Reduced motion holds
 * the bars still.
 */
const SKELETON_PULSE_S = 1.8;
const SKELETON_ROW_STAGGER_MS = 70;

/**
 * Fixed widths so server and client render the same markup. Uneven like real titles,
 * and short enough to clear the row's action button gutter (`pr-10`).
 */
const ROW_WIDTHS = ["78%", "62%", "85%", "54%", "70%", "66%", "81%", "58%", "74%", "49%"];

/** Placeholder rows matching a thread row's height, inset, and text size. */
export function SidebarThreadRowsSkeleton({ rows = ROW_WIDTHS.length }: { rows?: number }) {
  return (
    <SidebarMenu aria-hidden="true" className="h-fit w-full">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex h-7 items-center px-3 pr-10">
          <span
            className="block h-2.5 animate-pulse rounded-full bg-foreground/[0.07] motion-reduce:animate-none dark:bg-foreground/[0.09]"
            style={{
              width: ROW_WIDTHS[i % ROW_WIDTHS.length],
              animationDuration: `${SKELETON_PULSE_S}s`,
              animationDelay: `${i * SKELETON_ROW_STAGGER_MS}ms`,
            }}
          />
        </li>
      ))}
    </SidebarMenu>
  );
}

/**
 * Stand-in for the whole thread list while the session or first page loads. Keeps the
 * real "All Threads" heading so the layout does not shift when rows arrive.
 */
export function SidebarChatsSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading threads"
      className={cn("flex flex-col gap-1 py-1", className)}
      role="status"
    >
      <SidebarGroup className="shrink-0">
        <SidebarGroupLabel>
          <div className="text-foreground">
            <h2>All Threads</h2>
          </div>
        </SidebarGroupLabel>
        <SidebarThreadRowsSkeleton />
      </SidebarGroup>
    </div>
  );
}
