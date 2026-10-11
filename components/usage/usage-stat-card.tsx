import { Skeleton } from "@/components/third-party/ui/skeleton";
import { cn } from "@/lib/utils";

/** The same card and value height are used before and after usage arrives. */
export function UsageStatCard({
  label,
  value,
  accent,
  subtle,
}: {
  label: string;
  value?: string;
  accent?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
      <p className="text-2xs uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
      <div
        className={cn(
          "mt-1 flex h-7 items-center text-lg font-semibold tabular-nums sm:text-xl",
          accent ? "text-lumen" : subtle ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {value === undefined ? (
          <Skeleton className="h-5 w-16 bg-muted-foreground/10 motion-reduce:animate-none" />
        ) : (
          value
        )}
      </div>
    </div>
  );
}
