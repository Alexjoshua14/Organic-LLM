import { describe, expect, test } from "bun:test";

import { htmlToText, humanizeDuration, parseRecipeFromHtml } from "@/lib/mise/fetch-recipe";

const JSON_LD_PAGE = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Lemon Blueberry Poppyseed Bars",
  "recipeYield": "16 squares",
  "prepTime": "PT20M",
  "cookTime": "PT1H",
  "recipeIngredient": ["1.5 cups flour", "2 tbsp poppyseeds", "1 cup blueberries"],
  "recipeInstructions": [
    { "@type": "HowToStep", "text": "Make the shortbread base." },
    { "@type": "HowToStep", "text": "Add the curd layers and bake." }
  ]
}
</script>
</head><body>Recipe</body></html>
`;

const GRAPH_PAGE = `
<script type="application/ld+json">
{ "@context": "https://schema.org", "@graph": [
  { "@type": "WebPage" },
  { "@type": ["Recipe"], "name": "Fresh Pita",
    "recipeIngredient": ["3 cups flour", "1 packet yeast"],
    "recipeInstructions": "Mix, proof, and cook." }
] }
</script>
`;

describe("parseRecipeFromHtml", () => {
  test("extracts a schema.org Recipe with steps and ingredients", () => {
    const recipe = parseRecipeFromHtml(JSON_LD_PAGE, "https://example.com/bars");

    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe("Lemon Blueberry Poppyseed Bars");
    expect(recipe!.sourceUrl).toBe("https://example.com/bars");
    expect(recipe!.servings).toBe("16 squares");
    expect(recipe!.prepTime).toBe("20m");
    expect(recipe!.cookTime).toBe("1h");
    expect(recipe!.ingredients.map((i) => i.name)).toContain("2 tbsp poppyseeds");
    expect(recipe!.steps.length).toBe(2);
  });

  test("finds a Recipe nested inside an @graph and a string instruction", () => {
    const recipe = parseRecipeFromHtml(GRAPH_PAGE, "https://example.com/pita");

    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe("Fresh Pita");
    expect(recipe!.steps).toEqual(["Mix, proof, and cook."]);
  });

  test("returns null when there is no recipe JSON-LD", () => {
    expect(parseRecipeFromHtml("<html><body>no recipe</body></html>", "https://x.com")).toBeNull();
  });
});

describe("humanizeDuration", () => {
  test("converts ISO-8601 durations", () => {
    expect(humanizeDuration("PT1H30M")).toBe("1h 30m");
    expect(humanizeDuration("PT45M")).toBe("45m");
  });

  test("passes through non-ISO strings and ignores empties", () => {
    expect(humanizeDuration("about an hour")).toBe("about an hour");
    expect(humanizeDuration(undefined)).toBeUndefined();
  });
});

describe("htmlToText", () => {
  test("strips tags and scripts", () => {
    const text = htmlToText("<div>Hello <script>bad()</script><b>world</b></div>");

    expect(text).toBe("Hello world");
  });
});
