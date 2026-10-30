import type { ReactNode } from "react";

import { ChevronRight } from "lucide-react";

export function SettingsHelp({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group min-w-0 text-xs text-muted-foreground">
      <summary className="flex min-h-7 w-fit cursor-pointer list-none items-center gap-inline-sm rounded-md hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 group-open:rotate-90" />
        {title}
      </summary>
      <div className="space-y-stack-sm pb-inset-sm text-xs leading-relaxed [&_p]:text-xs [&_p]:leading-relaxed [overflow-wrap:anywhere]">
        {children}
      </div>
    </details>
  );
}
