"use client";

import type { RestaurantMenu } from "@/lib/schemas/gen-ui/restaurant-card";

import { cn } from "@/lib/utils";

type RestaurantCardMenuProps = {
  menu: RestaurantMenu;
  partial?: boolean;
};

function formatMenuDate(iso: string): string {
  const parsed = Date.parse(iso);

  if (Number.isNaN(parsed)) return iso;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

export function RestaurantCardMenu({ menu, partial }: RestaurantCardMenuProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Menu
        </p>
        <p className="text-[11px] text-muted-foreground">
          Updated {formatMenuDate(menu.lastUpdated)}
          {menu.sourceNote ? ` · ${menu.sourceNote}` : null}
        </p>
      </div>

      <div className="space-y-4">
        {menu.sections.map((section) => (
          <div key={section.name}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
              {section.name}
            </h4>
            <ul className="space-y-2.5">
              {section.items.map((item, index) => (
                <li
                  key={`${section.name}-${item.name}-${index}`}
                  className="flex items-start justify-between gap-3 border-b border-border/30 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.description ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    {item.dietaryTags && item.dietaryTags.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.dietaryTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {item.price ? (
                    <span className="shrink-0 text-sm tabular-nums text-foreground">{item.price}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {partial ? <div className={cn("h-3 w-2/3 rounded bg-muted/40 animate-pulse")} /> : null}
    </section>
  );
}
