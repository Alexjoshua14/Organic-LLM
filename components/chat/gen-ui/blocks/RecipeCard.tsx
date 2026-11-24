"use client";

import type { ReactNode } from "react";
import type { RecipeCardBlock } from "@/lib/schemas/gen-ui";

import {
  Beef,
  ChefHat,
  Clock,
  CookingPot,
  ExternalLink,
  Globe,
  ListOrdered,
  Timer,
  Users,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";

import { recipeIngredientToText, RECIPE_COMPLEXITY_LABEL } from "@/lib/schemas/gen-ui";
import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";
import { cn } from "@/lib/utils";

type RecipeCardProps = {
  block: RecipeCardBlock;
  partial?: boolean;
  condensed?: boolean;
};

/** Ingredient chips shown before the rest collapse into a "+N" chip. */
const CONDENSED_INGREDIENTS = 4;

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-inline-xs rounded-lg bg-muted/30 p-inset-sm">
      <dt className="inline-flex items-center gap-inline-xs text-2xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-semibold leading-snug tabular-nums text-foreground wrap-anywhere">
        {value}
      </dd>
    </div>
  );
}

/** Condensed: title with its meta chips, stat tiles, the first ingredients as chips. */
function RecipeCardCondensed({ block, partial }: Omit<RecipeCardProps, "condensed">) {
  const time =
    block.duration || [block.prepTime, block.cookTime].filter(Boolean).join(" + ") || undefined;
  const meta: MetaChipData[] = [];

  if (block.complexity)
    meta.push({
      key: "complexity",
      icon: <ChefHat className="size-3" />,
      label: RECIPE_COMPLEXITY_LABEL[block.complexity],
    });
  if (block.cuisine)
    meta.push({ key: "cuisine", icon: <Globe className="size-3" />, label: block.cuisine });

  const shown = block.ingredients.slice(0, CONDENSED_INGREDIENTS);
  const more = block.ingredients.length - shown.length;

  return (
    <div className="space-y-stack-sm">
      <div className="flex items-center gap-inline-sm">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"
        >
          <CookingPot className="size-4" />
        </span>
        <div className="min-w-0 space-y-stack-xs">
          <p className="text-sm font-semibold leading-snug text-foreground wrap-anywhere">
            {block.title}
          </p>
          {meta.length > 0 ? (
            <div className="flex flex-wrap items-center gap-inline-md">
              {meta.map((m) => (
                <MetaChip key={m.key} icon={m.icon} label={m.label} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-inline-sm sm:grid-cols-4">
        {block.servings ? (
          <StatTile icon={<Users className="size-3" />} label="Serves" value={block.servings} />
        ) : null}
        {time ? <StatTile icon={<Timer className="size-3" />} label="Time" value={time} /> : null}
        <StatTile
          icon={<Wheat className="size-3" />}
          label="Ingredients"
          value={String(block.ingredients.length)}
        />
        <StatTile
          icon={<ListOrdered className="size-3" />}
          label="Steps"
          value={String(block.steps.length)}
        />
      </dl>

      <ul className="flex flex-wrap gap-inline-xs" aria-label="Main ingredients">
        {shown.map((ing, i) => (
          <li
            key={i}
            className="max-w-full rounded-full bg-muted/40 px-inset-sm py-0.5 text-xs text-foreground wrap-anywhere"
          >
            {ing.name}
          </li>
        ))}
        {more > 0 ? (
          <li className="rounded-full px-inset-sm py-0.5 text-xs text-muted-foreground">
            +{more} more
          </li>
        ) : null}
      </ul>

      <details>
        <summary className="organic-focus w-fit cursor-pointer text-xs font-medium text-muted-foreground">
          Ingredients & method
        </summary>
        <div className="mt-stack-sm space-y-stack-sm">
          <ul className="space-y-stack-xs text-xs text-foreground" aria-label="Ingredients">
            {block.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-inline-sm">
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                <span>{recipeIngredientToText(ing)}</span>
              </li>
            ))}
          </ul>
          <ol className="space-y-stack-xs text-xs text-foreground" aria-label="Steps">
            {block.steps.map((step, i) => (
              <li key={i} className="flex gap-inline-sm">
                <span className="shrink-0 font-medium text-muted-foreground">{i + 1}.</span>
                <span>
                  <GenUIMarkdown inline>{step}</GenUIMarkdown>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </details>

      {partial ? <div className="h-3 w-1/2 animate-pulse rounded bg-muted/40" /> : null}
    </div>
  );
}

type MetaChipData = { key: string; icon: ReactNode; label: string };

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-inline-xs text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

export function RecipeCard({ block, partial, condensed = false }: RecipeCardProps) {
  if (condensed) return <RecipeCardCondensed block={block} partial={partial} />;

  const meta: MetaChipData[] = [];

  if (block.servings)
    meta.push({
      key: "servings",
      icon: <Users className="size-3" />,
      label: `Serves ${block.servings}`,
    });
  if (block.complexity)
    meta.push({
      key: "complexity",
      icon: <ChefHat className="size-3" />,
      label: RECIPE_COMPLEXITY_LABEL[block.complexity],
    });
  if (block.duration)
    meta.push({
      key: "duration",
      icon: <Timer className="size-3" />,
      label: `Total ${block.duration}`,
    });
  if (block.prepTime)
    meta.push({ key: "prep", icon: <Clock className="size-3" />, label: `Prep ${block.prepTime}` });
  if (block.cookTime)
    meta.push({
      key: "cook",
      icon: <UtensilsCrossed className="size-3" />,
      label: `Cook ${block.cookTime}`,
    });
  if (block.mainProtein)
    meta.push({
      key: "protein",
      icon: <Beef className="size-3" />,
      label: block.mainProtein,
    });
  if (block.mainCarbs)
    meta.push({ key: "carbs", icon: <Wheat className="size-3" />, label: block.mainCarbs });
  if (block.cuisine)
    meta.push({ key: "cuisine", icon: <Globe className="size-3" />, label: block.cuisine });
  if (block.equipment?.length)
    meta.push({
      key: "equipment",
      icon: <CookingPot className="size-3" />,
      label: block.equipment.join(", "),
    });

  return (
    <div className="space-y-stack-md">
      <div className="space-y-stack-xs">
        <p className="text-sm font-semibold text-foreground">{block.title}</p>
        {meta.length > 0 ? (
          <div className="flex flex-wrap items-center gap-inline-md">
            {meta.map((m) => (
              <MetaChip key={m.key} icon={m.icon} label={m.label} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ingredients
          </p>
          <ul className="space-y-stack-xs text-xs text-foreground">
            {block.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-inline-sm">
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                <span>{recipeIngredientToText(ing)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Steps
          </p>
          <ol className="space-y-1.5 text-xs text-foreground">
            {block.steps.map((step, i) => (
              <li key={i} className="flex gap-inline-sm">
                <span className="shrink-0 font-medium text-muted-foreground">{i + 1}.</span>
                <span>
                  <GenUIMarkdown inline>{step}</GenUIMarkdown>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {block.notes ? (
        <p className="text-xs text-muted-foreground">
          <GenUIMarkdown inline>{block.notes}</GenUIMarkdown>
        </p>
      ) : null}

      {block.sourceUrl ? (
        <a
          className="inline-flex items-center gap-inline-xs text-xs text-primary hover:underline"
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
