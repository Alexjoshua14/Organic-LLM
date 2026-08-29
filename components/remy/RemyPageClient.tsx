"use client";

import type { RecipeCardBody } from "@/lib/schemas/gen-ui/recipe-card";
import type { PrepRecipe, PrepSlot, PrepWeekIngredient } from "@/lib/schemas/prep";
import type { PrepWeekBundle } from "@/data/supabase/prep";
import type { RemyMode } from "@/lib/prep";
import type { RemyAskContext } from "./RemySlotPanel";
import type { RemySlotKey } from "./RemyWeekGrid";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { RemyChatDock } from "./RemyChatDock";
import { RemyLibraryView } from "./RemyLibraryView";
import { RemyModeSwitcher } from "./RemyModeSwitcher";
import { RemyRecipeEditor } from "./RemyRecipeEditor";
import { RemyShoppingView } from "./RemyShoppingView";
import { RemySlotPanel } from "./RemySlotPanel";
import { RemyWeekGrid } from "./RemyWeekGrid";
import { RemyWeekNav } from "./RemyWeekNav";

import { pageContentFrameInsets } from "@/lib/layout/nav-chrome";
import { cn } from "@/lib/utils";
import {
  formatWeekRange,
  localCalendarIso,
  mondayOf,
  prepRecipeToBlock,
  remyDashboardHref,
  shiftWeek,
} from "@/lib/prep";
import {
  clearPrepPlacement,
  deletePrepRecipe,
  ensurePrepWeek,
  getPrepWeekBundle,
  listPrepRecipes,
  setPrepLeftover,
  setPrepWeekIngredientStatus,
  updatePrepRecipe,
  upsertPrepPlacement,
  upsertPrepRecipe,
} from "@/data/supabase/prep";
import { Button } from "@/components/third-party/ui/button";
import { glass } from "@/components/design-system/primitives";
import { RecipeCard } from "@/components/chat/gen-ui/blocks/RecipeCard";

const REMY_COLUMN = "mx-auto w-full max-w-7xl px-6";

type RemyPageClientProps = {
  weekStart: string;
  initialMode: RemyMode;
  initialLibrary: PrepRecipe[];
  initialBundle: PrepWeekBundle | null;
};

function emptyBundle(): Pick<PrepWeekBundle, "placements" | "recipes" | "ingredients"> {
  return { placements: [], recipes: {}, ingredients: [] };
}

export function RemyPageClient({
  weekStart,
  initialMode,
  initialLibrary,
  initialBundle,
}: RemyPageClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<RemyMode>(initialMode);
  const [library, setLibrary] = useState(initialLibrary);
  const [weekId, setWeekId] = useState(initialBundle?.week.id ?? null);
  const [placements, setPlacements] = useState(initialBundle?.placements ?? []);
  const [weekRecipes, setWeekRecipes] = useState(initialBundle?.recipes ?? {});
  const [ingredients, setIngredients] = useState<PrepWeekIngredient[]>(
    initialBundle?.ingredients ?? []
  );

  const [selected, setSelected] = useState<RemySlotKey | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PrepRecipe | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [askContext, setAskContext] = useState<RemyAskContext | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setLibrary(initialLibrary);
    setWeekId(initialBundle?.week.id ?? null);
    setPlacements(initialBundle?.placements ?? []);
    setWeekRecipes(initialBundle?.recipes ?? {});
    setIngredients(initialBundle?.ingredients ?? []);
    setSelected(null);
    setAssignOpen(false);
  }, [weekStart, initialMode, initialLibrary, initialBundle]);

  const navigate = useCallback(
    (nextWeek: string, nextMode: RemyMode) => {
      router.replace(remyDashboardHref(nextWeek, nextMode));
    },
    [router]
  );

  const applyBundle = (bundle: PrepWeekBundle | null) => {
    if (!bundle) {
      setWeekId(null);
      const empty = emptyBundle();

      setPlacements(empty.placements);
      setWeekRecipes(empty.recipes);
      setIngredients(empty.ingredients);

      return;
    }

    setWeekId(bundle.week.id);
    setPlacements(bundle.placements);
    setWeekRecipes(bundle.recipes);
    setIngredients(bundle.ingredients);
  };

  const refresh = async (start = weekStart) => {
    const [nextLibrary, bundle] = await Promise.all([listPrepRecipes(), getPrepWeekBundle(start)]);

    setLibrary(nextLibrary);
    applyBundle(bundle);
  };

  const ensureWeek = async () => {
    const week = await ensurePrepWeek(weekStart);

    setWeekId(week.id);

    return week.id;
  };

  const recipesById = useMemo(() => {
    const map: Record<string, PrepRecipe> = { ...weekRecipes };

    for (const recipe of library) map[recipe.id] = recipe;

    return map;
  }, [library, weekRecipes]);

  const selectedPlacement = selected
    ? placements.find((p) => p.date === selected.date && p.slot === selected.slot)
    : undefined;
  const selectedRecipe = selectedPlacement ? recipesById[selectedPlacement.recipeId] : undefined;

  const cookPlacements = placements.filter((p) => {
    if (p.leftoverOfPlacementId) return false;
    if (selected && p.date === selected.date && p.slot === selected.slot) return false;

    return true;
  });

  const onModeChange = (next: RemyMode) => {
    setMode(next);
    navigate(weekStart, next);
  };

  const handleAssignRecipe = async (recipeId: string) => {
    if (!selected) return;

    try {
      const id = await ensureWeek();

      await upsertPrepPlacement({
        weekId: id,
        date: selected.date,
        slot: selected.slot,
        recipeId,
      });
      await refresh();
      setAssignOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place recipe");
    }
  };

  const handleAssignLeftover = async (sourcePlacementId: string) => {
    if (!selected) return;

    try {
      const id = await ensureWeek();

      await setPrepLeftover(id, selected.date, selected.slot, sourcePlacementId);
      await refresh();
      setAssignOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set leftover");
    }
  };

  const handleClearSlot = async (key: RemySlotKey) => {
    if (!weekId) return;

    try {
      await clearPrepPlacement(weekId, key.date, key.slot);
      await refresh();
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear slot");
    }
  };

  const handlePlaceOnWeek = async (recipeId: string, date: string, slot: PrepSlot) => {
    try {
      const id = await ensureWeek();

      await upsertPrepPlacement({ weekId: id, date, slot, recipeId });
      await refresh();
      toast.success("Placed on this week");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place recipe");
    }
  };

  const handleSaveRecipe = async (body: RecipeCardBody) => {
    if (editing) {
      await updatePrepRecipe(editing.id, body);
    } else {
      await upsertPrepRecipe({ clientKey: crypto.randomUUID(), ...body });
    }
    await refresh();
  };

  const handleDeleteRecipe = async (recipe: PrepRecipe) => {
    try {
      await deletePrepRecipe(recipe.id);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete recipe");
    }
  };

  const openAskRemy = (ctx: RemyAskContext) => {
    setAskContext(ctx);
    setChatOpen(true);
    setAssignOpen(false);
  };

  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 w-full flex-1 flex-col pb-4 md:pb-8",
        pageContentFrameInsets
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className={cn("shrink-0 space-y-2 py-2 md:space-y-3 md:py-6", REMY_COLUMN)}>
          <div className="flex items-center gap-2 md:justify-between">
            <div className="hidden min-w-0 select-none md:block">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Remy</p>
              <h1 className="font-commissioner text-2xl font-light tracking-wide text-foreground sm:text-3xl">
                Meal prep
              </h1>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:flex-none">
              <RemyWeekNav
                weekStart={weekStart}
                onNext={() => navigate(shiftWeek(weekStart, 1), mode)}
                onPrev={() => navigate(shiftWeek(weekStart, -1), mode)}
                onThisWeek={() => navigate(mondayOf(localCalendarIso()), mode)}
              />
              <RemyModeSwitcher value={mode} onChange={onModeChange} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAskContext(null);
                  setChatOpen(true);
                }}
              >
                <MessageSquare className="size-4" />
                Chat
              </Button>
            </div>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 w-full overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
          <div className={cn(REMY_COLUMN, "min-h-full pb-2 md:pb-4")}>
            <div className={cn("min-h-full rounded-xl p-inset-md", glass({ opaque: true }))}>
              {mode === "week" ? (
                <div className="space-y-stack-lg">
                  <RemyWeekGrid
                    placements={placements}
                    recipes={recipesById}
                    selected={selected}
                    weekStart={weekStart}
                    onSelectEmpty={(key) => {
                      setSelected(key);
                      setAssignOpen(true);
                    }}
                    onSelectFilled={(key) => {
                      setSelected(key);
                      setAssignOpen(false);
                    }}
                  />
                  {selectedPlacement && selectedRecipe ? (
                    <div
                      className={cn(
                        glass({ border: "all" }),
                        "rounded-xl p-inset-md space-y-stack-md"
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {selectedRecipe.title}
                          </p>
                          {selectedPlacement.leftoverOfPlacementId ? (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                              Leftover
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-inline-sm">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              selected &&
                              openAskRemy({
                                date: selected.date,
                                slot: selected.slot,
                                recipeTitle: selectedRecipe.title,
                              })
                            }
                          >
                            Ask Remy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAssignOpen(true);
                            }}
                          >
                            Reassign
                          </Button>
                          {selected ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleClearSlot(selected)}
                            >
                              Clear slot
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <RecipeCard block={prepRecipeToBlock(selectedRecipe)} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === "library" ? (
                <RemyLibraryView
                  recipes={library}
                  weekStart={weekStart}
                  onCreate={() => {
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                  onDelete={(recipe) => void handleDeleteRecipe(recipe)}
                  onEdit={(recipe) => {
                    setEditing(recipe);
                    setEditorOpen(true);
                  }}
                  onPlace={(recipeId, date, slot) => void handlePlaceOnWeek(recipeId, date, slot)}
                />
              ) : null}

              {mode === "shopping" ? (
                <RemyShoppingView
                  ingredients={ingredients}
                  weekLabel={formatWeekRange(weekStart)}
                  onToggleChecked={(identity, checked) => {
                    if (!weekId) return;
                    void setPrepWeekIngredientStatus(weekId, identity, { checked })
                      .then(() => refresh())
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Could not update item")
                      );
                  }}
                  onToggleStatus={(identity, status) => {
                    if (!weekId) return;
                    void setPrepWeekIngredientStatus(weekId, identity, { status })
                      .then(() => refresh())
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Could not update item")
                      );
                  }}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <RemySlotPanel
        cookPlacements={cookPlacements}
        library={library}
        open={assignOpen}
        recipes={recipesById}
        slot={selected}
        onAskRemy={openAskRemy}
        onAssignLeftover={(id) => void handleAssignLeftover(id)}
        onAssignRecipe={(id) => void handleAssignRecipe(id)}
        onClose={() => setAssignOpen(false)}
      />

      <RemyRecipeEditor
        open={editorOpen}
        recipe={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={handleSaveRecipe}
      />

      <RemyChatDock askContext={askContext} open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
