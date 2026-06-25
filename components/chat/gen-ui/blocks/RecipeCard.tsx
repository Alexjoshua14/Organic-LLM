"use client";

import type { ReactNode } from "react";
import type { RecipeCardBlock } from "@/lib/schemas/gen-ui";

import { Clock, ExternalLink, Users, UtensilsCrossed } from "lucide-react";

import { recipeIngredientToText } from "@/lib/schemas/gen-ui";
import { cn } from "@/lib/utils";

type RecipeCardProps = {
  block: RecipeCardBlock;
  partial?: boolean;
};

type MetaChipData = { key: string; icon: ReactNode; label: string };

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

export function RecipeCard({ block, partial }: RecipeCardProps) {
  const meta: MetaChipData[] = [];

  if (block.servings)
    meta.push({
      key: "servings",
      icon: <Users className="size-3" />,
      label: `Serves ${block.servings}`,
    });
  if (block.prepTime)
    meta.push({ key: "prep", icon: <Clock className="size-3" />, label: `Prep ${block.prepTime}` });
  if (block.cookTime)
    meta.push({
      key: "cook",
      icon: <UtensilsCrossed className="size-3" />,
      label: `Cook ${block.cookTime}`,
    });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{block.title}</p>
        {meta.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {meta.map((m) => (
              <MetaChip key={m.key} icon={m.icon} label={m.label} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ingredients
          </p>
          <ul className="space-y-1 text-xs text-foreground">
            {block.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                <span>{recipeIngredientToText(ing)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Steps
          </p>
          <ol className="space-y-1.5 text-xs text-foreground">
            {block.steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-medium text-muted-foreground">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {block.notes ? <p className="text-xs text-muted-foreground">{block.notes}</p> : null}

      {block.sourceUrl ? (
        <a
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          href={block.sourceUrl}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          <ExternalLink className="size-3" />
          Source
        </a>
      ) : null}

      {partial ? <div className={cn("h-3 w-1/2 rounded bg-muted/40 animate-pulse")} /> : null}
    </div>
  );
}
