import { Layers } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

/** Pulsing placeholder while a Stratum tool call streams in. */
export function StratumLoadingShell({ label }: { label: string }) {
  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "not-prose flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2.5"
      )}
    >
      <Layers className="size-3.5 animate-pulse text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
