import { Sunrise } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function GoodNewsEmpty() {
  return (
    <div
      className={cn(glass(), "flex flex-col items-center rounded-2xl px-6 py-16 text-center")}
      role="status"
    >
      <Sunrise aria-hidden="true" className="mb-4 h-10 w-10 text-accent" />
      <h2 className="text-lg font-semibold text-foreground">Today&apos;s good news is brewing</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        We verify every story across multiple credible sources before publishing, so the digest
        takes a little time to prepare. Please check back soon.
      </p>
    </div>
  );
}
