"use client";

import type { StrataPage } from "@/lib/schemas/strata";

import { useRouter } from "next/navigation";

import { createAndOpenStrataPageAction } from "../actions";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { createLocalStrataPage, listLocalStrataPages } from "@/lib/strata/local-store";

type StrataCreatePageFormProps = {
  dbAvailable: boolean;
  onLocalPagesUpdated: (pages: StrataPage[]) => void;
};

export function StrataCreatePageForm({
  dbAvailable,
  onLocalPagesUpdated,
}: StrataCreatePageFormProps) {
  const router = useRouter();

  if (dbAvailable) {
    return (
      <form
        action={createAndOpenStrataPageAction}
        className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
      >
        <input
          className={cn(
            glass(),
            "h-10 w-full min-w-0 flex-1 rounded-lg border px-3 text-sm text-foreground placeholder:text-muted-foreground"
          )}
          name="title"
          placeholder="Optional title"
          type="text"
        />
        <button
          className={cn(
            glass({ opaque: true }),
            "h-10 w-full shrink-0 rounded-lg border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted cursor-pointer select-none sm:w-auto"
          )}
          type="submit"
        >
          <p className="select-none">Create new page</p>
        </button>
      </form>
    );
  }

  return (
    <button
      className={cn(
        glass({ opaque: true }),
        "h-10 w-full rounded-lg border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-auto cursor-pointer select-none"
      )}
      type="button"
      onClick={async () => {
        const page = await createLocalStrataPage();

        onLocalPagesUpdated(await listLocalStrataPages());
        router.push(`/sandbox/prototypes/strata/${page.page.id}`);
      }}
    >
      Create new local page
    </button>
  );
}
