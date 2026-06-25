import type { MiseEvent } from "./event";
import type { MiseIngredient } from "./ingredient";
import type { MiseRecipe } from "./recipe";
import type { InitiatePlanCommand } from "./command";

/** Canonical example: the housewarming. Used by tests and as a reference shape. */
export const HOUSEWARMING_EVENT: MiseEvent = {
  id: "housewarming",
  title: "Housewarming",
  date: "2026-06-27",
  time: "7:30 PM",
  guestCount: 15,
  timeline: [
    {
      id: "friday",
      label: "Friday (day before)",
      status: "next",
      time: "Friday",
      substeps: [
        { label: "Bake lemon blueberry poppyseed bars" },
        { label: "Refrigerate bars overnight (min 4 hrs)" },
        { label: "Make hummus" },
      ],
    },
    {
      id: "sat-morning",
      label: "Saturday morning",
      status: "next",
      substeps: [{ label: "Mix pita dough, let rest/proof" }],
    },
    {
      id: "sat-evening",
      label: "Saturday evening",
      status: "next",
      substeps: [
        { label: "Cook pita", time: "~6:00 PM" },
        { label: "Plate hummus at room temp; slice & dust bars", time: "~7:00 PM" },
        { label: "Guests arrive 🎉", time: "7:30 PM" },
      ],
    },
  ],
};

export const HOUSEWARMING_RECIPES: MiseRecipe[] = [
  {
    id: "bars",
    title: "Lemon blueberry poppyseed bars",
    servings: "16 small squares",
    ingredients: [
      { name: "flour", quantity: "1.5", unit: "cups" },
      { name: "poppyseeds", quantity: "2", unit: "tbsp" },
      { name: "blueberries", quantity: "1", unit: "cup" },
      { name: "lemons", quantity: "3" },
    ],
    steps: [
      "Make poppyseed shortbread base and par-bake.",
      "Pour blueberry curd and lemon curd layers over the base.",
      "Bake, cool, then refrigerate at least 4 hours before slicing.",
    ],
    notes: "Yields 9 large or 16 small squares; for 15 guests make a 1.5–2x batch.",
  },
  {
    id: "pita",
    title: "Fresh pita",
    ingredients: [
      { name: "flour", quantity: "3", unit: "cups" },
      { name: "yeast", quantity: "1", unit: "packet" },
    ],
    steps: ["Mix dough and proof.", "Roll and cook on a hot surface until puffed."],
  },
];

export const HOUSEWARMING_INGREDIENTS: MiseIngredient[] = [
  {
    id: "ing-flour",
    name: "flour",
    quantity: "5",
    unit: "cups",
    category: "Pantry",
    status: "have",
    checked: false,
  },
  {
    id: "ing-blueberries",
    recipeId: "bars",
    name: "blueberries",
    quantity: "1",
    unit: "cup",
    category: "Produce",
    status: "need",
    checked: false,
  },
  {
    id: "ing-lemons",
    recipeId: "bars",
    name: "lemons",
    quantity: "3",
    category: "Produce",
    status: "need",
    checked: false,
  },
];

export const HOUSEWARMING_INITIATE: InitiatePlanCommand = {
  type: "INITIATE_PLAN",
  version: 1,
  event: HOUSEWARMING_EVENT,
  seedRecipes: HOUSEWARMING_RECIPES,
  seedIngredients: HOUSEWARMING_INGREDIENTS,
};
