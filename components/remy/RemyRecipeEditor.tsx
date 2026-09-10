"use client";

import type { RecipeCardBody, RecipeIngredient } from "@/lib/schemas/gen-ui/recipe-card";
import type { PrepRecipe } from "@/lib/schemas/prep";

import { useEffect, useState } from "react";

import { RECIPE_COMPLEXITIES } from "@/lib/schemas/gen-ui/recipe-card";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import { Label } from "@/components/third-party/ui/label";
import { Textarea } from "@/components/third-party/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/third-party/ui/sheet";

type IngredientDraft = { name: string; quantity: string; unit: string };

type RemyRecipeEditorProps = {
  open: boolean;
  recipe: PrepRecipe | null;
  onClose: () => void;
  onSave: (body: RecipeCardBody) => void | Promise<void>;
};

function ingredientsFromRecipe(recipe: PrepRecipe | null): IngredientDraft[] {
  if (!recipe?.ingredients.length) return [{ name: "", quantity: "", unit: "" }];

  return recipe.ingredients.map((ing) => ({
    name: ing.name,
    quantity: ing.quantity ?? "",
    unit: ing.unit ?? "",
  }));
}

export function RemyRecipeEditor({ open, recipe, onClose, onSave }: RemyRecipeEditorProps) {
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");
  const [duration, setDuration] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [complexity, setComplexity] = useState<string>("");
  const [mainProtein, setMainProtein] = useState("");
  const [mainCarbs, setMainCarbs] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [equipment, setEquipment] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { name: "", quantity: "", unit: "" },
  ]);
  const [stepsText, setStepsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTitle(recipe?.title ?? "");
    setServings(recipe?.servings ?? "");
    setDuration(recipe?.duration ?? "");
    setPrepTime(recipe?.prepTime ?? "");
    setCookTime(recipe?.cookTime ?? "");
    setComplexity(recipe?.complexity ?? "");
    setMainProtein(recipe?.mainProtein ?? "");
    setMainCarbs(recipe?.mainCarbs ?? "");
    setCuisine(recipe?.cuisine ?? "");
    setEquipment(recipe?.equipment?.join(", ") ?? "");
    setNotes(recipe?.notes ?? "");
    setSourceUrl(recipe?.sourceUrl ?? "");
    setIngredients(ingredientsFromRecipe(recipe));
    setStepsText(recipe?.steps.join("\n") ?? "");
    setError(null);
  }, [open, recipe]);

  const save = async () => {
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedIngredients: RecipeIngredient[] = ingredients
      .map((ing) => ({
        name: ing.name.trim(),
        quantity: ing.quantity.trim() || undefined,
        unit: ing.unit.trim() || undefined,
      }))
      .filter((ing) => ing.name.length > 0);

    if (!title.trim()) {
      setError("Title is required.");

      return;
    }
    if (parsedIngredients.length === 0 || steps.length === 0) {
      setError("Add at least one ingredient and one step.");

      return;
    }

    const equipmentList = equipment
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const body: RecipeCardBody = {
      title: title.trim(),
      ingredients: parsedIngredients,
      steps,
      servings: servings.trim() || undefined,
      duration: duration.trim() || undefined,
      prepTime: prepTime.trim() || undefined,
      cookTime: cookTime.trim() || undefined,
      complexity:
        complexity === "easy" || complexity === "medium" || complexity === "hard"
          ? complexity
          : undefined,
      mainProtein: mainProtein.trim() || undefined,
      mainCarbs: mainCarbs.trim() || undefined,
      cuisine: cuisine.trim() || undefined,
      equipment: equipmentList.length ? equipmentList : undefined,
      notes: notes.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
    };

    setPending(true);
    setError(null);

    try {
      await onSave(body);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>{recipe ? "Edit recipe" : "New recipe"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-stack-md">
          <div className="space-y-stack-xs">
            <Label htmlFor="remy-recipe-title">Title</Label>
            <Input
              id="remy-recipe-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-inline-sm">
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-complexity">Complexity</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                id="remy-recipe-complexity"
                value={complexity}
                onChange={(e) => setComplexity(e.target.value)}
              >
                <option value="">—</option>
                {RECIPE_COMPLEXITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-duration">Duration</Label>
              <Input
                id="remy-recipe-duration"
                placeholder="45 min"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-protein">Main protein</Label>
              <Input
                id="remy-recipe-protein"
                value={mainProtein}
                onChange={(e) => setMainProtein(e.target.value)}
              />
            </div>
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-carbs">Main carbs</Label>
              <Input
                id="remy-recipe-carbs"
                value={mainCarbs}
                onChange={(e) => setMainCarbs(e.target.value)}
              />
            </div>
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-servings">Servings</Label>
              <Input
                id="remy-recipe-servings"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-cuisine">Cuisine</Label>
              <Input
                id="remy-recipe-cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-stack-xs">
            <Label>Ingredients</Label>
            {ingredients.map((ing, i) => (
              <div key={i} className="grid grid-cols-[1fr_5rem_5rem_auto] gap-inline-sm">
                <Input
                  placeholder="Name"
                  value={ing.name}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, name: e.target.value } : row))
                    )
                  }
                />
                <Input
                  placeholder="Qty"
                  value={ing.quantity}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, quantity: e.target.value } : row))
                    )
                  }
                />
                <Input
                  placeholder="Unit"
                  value={ing.unit}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, unit: e.target.value } : row))
                    )
                  }
                />
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setIngredients((prev) =>
                      prev.length === 1 ? prev : prev.filter((_, j) => j !== i)
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() =>
                setIngredients((prev) => [...prev, { name: "", quantity: "", unit: "" }])
              }
            >
              Add ingredient
            </Button>
          </div>

          <div className="space-y-stack-xs">
            <Label htmlFor="remy-recipe-steps">Steps (one per line)</Label>
            <Textarea
              id="remy-recipe-steps"
              rows={6}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
          </div>

          <div className="space-y-stack-xs">
            <Label htmlFor="remy-recipe-equipment">Equipment (comma-separated)</Label>
            <Input
              id="remy-recipe-equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            />
          </div>
          <div className="space-y-stack-xs">
            <Label htmlFor="remy-recipe-notes">Notes</Label>
            <Textarea
              id="remy-recipe-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-stack-xs">
            <Label htmlFor="remy-recipe-source">Source URL</Label>
            <Input
              id="remy-recipe-source"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-inline-sm">
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-prep">Prep time</Label>
              <Input
                id="remy-recipe-prep"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
              />
            </div>
            <div className="space-y-stack-xs">
              <Label htmlFor="remy-recipe-cook">Cook time</Label>
              <Input
                id="remy-recipe-cook"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => void save()}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
