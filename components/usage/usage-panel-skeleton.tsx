import { UsageSectionHeader } from "./usage-section-header";
import { UsageStatCard } from "./usage-stat-card";

import { Skeleton } from "@/components/third-party/ui/skeleton";

function Placeholder({ className }: { className: string }) {
  return <Skeleton className={`bg-muted-foreground/10 motion-reduce:animate-none ${className}`} />;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="relative">
      <UsageSectionHeader caption={"\u00a0"} title={title} />
      <Placeholder className="absolute bottom-1 h-2 w-32" />
    </div>
  );
}

export function UsageTrackingNote() {
  return (
    <p className="text-xs text-muted-foreground">
      Tracked cost uses reported charges when available and estimates otherwise. Some older and
      auxiliary calls may be missing.
    </p>
  );
}

/** Reserve the dashboard's responsive sections, without suggesting that usage is zero. */
export function UsagePanelSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading usage…</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="flex h-5 items-center">
              <Placeholder className="h-3 w-16" />
            </div>
            <div className="flex h-4 items-center">
              <Placeholder className="h-2 w-28" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex h-4 items-center">
              <Placeholder className="h-2 w-28" />
            </div>
            <Placeholder className="h-1 w-full rounded-full" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex h-4 items-center">
              <Placeholder className="h-2 w-20" />
            </div>
            <span className="relative inline-flex h-8 items-center px-3 text-sm font-medium">
              <span className="invisible">Start a fresh window</span>
              <Placeholder className="absolute inset-x-3 h-2.5" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["Total tokens", "Tracked cost", "Input", "Output"].map((label) => (
            <UsageStatCard key={label} label={label} />
          ))}
        </div>

        <UsageTrackingNote />

        <section className="space-y-2">
          <SectionHeader title="Tokens over time" />
          <div className="rounded-xl border border-border/50 bg-muted/15 p-2">
            <Placeholder className="h-[120px] w-full" />
            <div className="mt-1 flex min-h-4 justify-between px-1 text-2xs">
              <span className="relative">
                <span className="invisible">00-00</span>
                <Placeholder className="absolute inset-x-0 top-1 h-2" />
              </span>
              <span className="relative">
                <span className="invisible">00-00</span>
                <Placeholder className="absolute inset-x-0 top-1 h-2" />
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <SectionHeader title="Plan allotment" />
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {["Free", "Plus", "Pro"].map((name) => (
              <div
                key={name}
                className="rounded-lg border border-border/50 bg-muted/15 px-2 py-2 text-center"
              >
                <p className="mb-1 font-commissioner text-2xs font-light tracking-wide text-foreground">
                  {name}
                </p>
                <div className="flex h-6 items-center justify-center sm:h-7">
                  <Placeholder className="h-4 w-10" />
                </div>
                <Placeholder className="mx-auto mt-1.5 h-1 w-full max-w-[3.5rem] rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <SectionHeader title="By model" />
          <div className="overflow-hidden rounded-xl border border-border/50">
            <div className="hidden h-8 border-b border-border/40 bg-muted/20 sm:block" />
            <div className="divide-y divide-border/30">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="grid gap-1 px-3 py-2 sm:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))] sm:items-center sm:gap-2"
                >
                  <div className="flex h-8 items-center sm:h-4">
                    <Placeholder className="h-2.5 w-24 max-w-full" />
                  </div>
                  {[0, 1, 2, 3, 4].map((cell) => (
                    <div
                      key={cell}
                      className={`${cell === 4 ? "hidden sm:flex" : "flex"} h-4 justify-end items-center`}
                    >
                      <Placeholder className="h-2 w-12 max-w-full" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex h-4 items-center">
          <Placeholder className="h-2 w-64 max-w-full" />
        </div>
      </div>
    </div>
  );
}
