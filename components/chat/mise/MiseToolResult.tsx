"use client";

import type { MisePlanState } from "@/lib/mise/types";

import { useCallback } from "react";
import { CalendarDays, ChefHat, MapPin, Users } from "lucide-react";

import { MiseLoadingShell } from "./MiseLoadingShell";

import { applyMiseCommand as persistMiseCommand } from "@/data/supabase/mise";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import { RecipeCard } from "@/components/chat/gen-ui/blocks/RecipeCard";
import {
  ShoppingList,
  type ShoppingItemLocation,
} from "@/components/chat/gen-ui/blocks/ShoppingList";
import { glass } from "@/components/design-system/primitives";
import { createLogger } from "@/lib/logger";
import { applyMiseCommand, useMisePlan } from "@/lib/mise/store";
import {
  buildShoppingList,
  hasShoppingItems,
  recipeToBlock,
  selectRecipes,
  timelineToBlock,
} from "@/lib/mise/select-view";
import { MisePlanToolOutputSchema, type MiseView } from "@/lib/schemas/mise";
import { cn } from "@/lib/utils";

const logger = createLogger("components/chat/mise/MiseToolResult.tsx");

type MiseToolResultProps = {
  threadId: string;
  output: unknown;
};

function PlanHeader({ plan }: { plan: MisePlanState }) {
  const { event } = plan;
  const dateLabel = [event.date, event.time].filter(Boolean).join(" · ");

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{event.title}</p>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {dateLabel ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            {dateLabel}
          </span>
        ) : null}
        {event.location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {event.location}
          </span>
        ) : null}
        {event.guestCount ? (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {event.guestCount} guests
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

/** Renders the `mise_plan` tool output: an anchored view, or a subtle mutation chip. */
export function MiseToolResult({ threadId, output }: MiseToolResultProps) {
  const plan = useMisePlan(threadId);

  const parsed = MisePlanToolOutputSchema.safeParse(output);

  const handleToggle = useCallback(
    (loc: ShoppingItemLocation, view: MiseView, kind: "checked" | "status") => {
      if (!plan) return;
      const { ids } = buildShoppingList(plan, view);
      const id = ids[loc.groupIndex]?.[loc.itemIndex];

      if (!id) return;
      const current = plan.ingredients[id];

      if (!current) return;

      const command =
        kind === "checked"
          ? ({ type: "SET_INGREDIENT_STATUS", version: 1, id, checked: !current.checked } as const)
          : ({
              type: "SET_INGREDIENT_STATUS",
              version: 1,
              id,
              status: current.status === "have" ? ("need" as const) : ("have" as const),
            } as const);

      // Optimistic local update, then persist to Supabase.
      applyMiseCommand(threadId, command);
      void persistMiseCommand(threadId, command).catch((err) => {
        logger.error("handleToggle", `Persist failed: ${String(err)}`);
      });
    },
    [plan, threadId]
  );

  if (!parsed.success) return null;

  // Mutation ack — a subtle chip; the plan renders elsewhere via SHOW_VIEW.
  if (parsed.data.kind === "mise-ack") {
    const count = parsed.data.count;

    return (
      <div className="not-prose inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background-tertiary/40 px-2.5 py-1 text-xs text-muted-foreground">
        <ChefHat className="size-3" />
        Plan updated
        {typeof count === "number" && count > 0 ? ` · ${count} item${count === 1 ? "" : "s"}` : ""}
      </div>
    );
  }

  const view = parsed.data.view;

  if (!plan || plan.status === "initializing") {
    return <MiseLoadingShell title={plan?.event.title ?? view.title} />;
  }

  const body = renderViewBody(plan, view, handleToggle);

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "not-prose overflow-hidden rounded-lg border border-border/50"
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2">
        <ChefHat className="size-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {view.title}
        </span>
      </div>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-3 py-3">
        {view.summary ? <p className="text-xs text-muted-foreground">{view.summary}</p> : null}
        {body}
      </div>
    </div>
  );
}

function renderViewBody(
  plan: MisePlanState,
  view: MiseView,
  handleToggle: (loc: ShoppingItemLocation, view: MiseView, kind: "checked" | "status") => void
) {
  switch (view.intent) {
    case "timeline": {
      if (plan.timeline.length === 0) return <EmptyState label="No prep schedule yet." />;

      return <PlanTimeline block={timelineToBlock(plan)} />;
    }

    case "recipe": {
      const recipes = selectRecipes(plan, view);

      if (recipes.length === 0) return <EmptyState label="No recipes yet." />;

      return (
        <div className="space-y-4">
          {recipes.map((r) => (
            <RecipeCard key={r.id} block={recipeToBlock(r)} />
          ))}
        </div>
      );
    }

    case "shopping-list":
    case "pantry": {
      if (!hasShoppingItems(plan, view)) {
        return (
          <EmptyState
            label={view.intent === "pantry" ? "Nothing marked as on hand." : "Nothing to buy yet."}
          />
        );
      }
      const { block } = buildShoppingList(plan, view);

      return (
        <ShoppingList
          block={block}
          onToggleChecked={(loc) => handleToggle(loc, view, "checked")}
          onToggleStatus={(loc) => handleToggle(loc, view, "status")}
        />
      );
    }

    case "menu": {
      const recipes = selectRecipes(plan, view);

      return (
        <div className="space-y-3">
          <PlanHeader plan={plan} />
          {recipes.length === 0 ? (
            <EmptyState label="No dishes on the menu yet." />
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {recipes.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <ChefHat className="size-3 text-muted-foreground" />
                  {r.title}
                  {r.servings ? (
                    <span className="text-[11px] text-muted-foreground">({r.servings})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    case "overview":
    default: {
      const recipes = selectRecipes(plan, view);
      const showShopping = hasShoppingItems(plan, view);
      const { block } = showShopping
        ? buildShoppingList(plan, view)
        : { block: null as null | ReturnType<typeof buildShoppingList>["block"] };

      return (
        <div className="space-y-4">
          <PlanHeader plan={plan} />
          {plan.timeline.length > 0 ? <PlanTimeline block={timelineToBlock(plan)} /> : null}
          {recipes.length > 0 ? (
            <div className="space-y-4">
              {recipes.map((r) => (
                <RecipeCard key={r.id} block={recipeToBlock(r)} />
              ))}
            </div>
          ) : null}
          {showShopping && block ? (
            <ShoppingList
              block={block}
              onToggleChecked={(loc) => handleToggle(loc, view, "checked")}
              onToggleStatus={(loc) => handleToggle(loc, view, "status")}
            />
          ) : null}
        </div>
      );
    }
  }
}
