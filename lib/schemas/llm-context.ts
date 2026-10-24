import z from "zod";

const MAX_PERSISTED_SCHEMAS = 3;

export const ListSchema = z.object({
  type: z.literal("list"),
  useCase: z
    .enum(["grocery_list", "todo_list", "bookmarks", "agenda", "other"])
    .describe(
      "The use case for this list, e.g., grocery_list, todo_list, bookmarks, agenda, other."
    ),
  items: z.array(z.string()).describe("The items in the list."),
});

export const KeyValueSchema = z.object({
  type: z.literal("keyValue"),
  useCase: z
    .enum(["env_var", "table_of_consciousness", "metadata", "setting", "other"])
    .describe(
      "The use case for this key-value pair, e.g., env_var, table_of_consciousness, metadata, setting, or other."
    ),
  key: z.string().describe("The key for the value."),
  value: z.string().describe("The associated value."),
});

export const CodeBlockSchema = z.object({
  type: z.literal("codeBlock"),
  useCase: z
    .enum(["code_snippet", "script", "example", "config", "other"])
    .describe(
      "The use case for this code block, e.g., code_snippet, script, example, config, or other."
    ),
  language: z.string().describe("The programming language of the code block."),
  code: z.string().describe("The code content of the code block."),
  caption: z.string().describe("An optional caption or description for the code block.").optional(),
});

export const RecipeCardSchema = z.object({
  type: z.literal("recipeCard"),
  useCase: z
    .enum([
      "main_dish",
      "side_dish",
      "dessert",
      "beverage",
      "appetizer",
      "snack",
      "breakfast",
      "other",
    ])
    .describe(
      "The use case or category for this recipe, e.g., main_dish, dessert, beverage, appetizer, snack, breakfast, other."
    ),
  title: z.string().describe("The title of the recipe."),
  description: z.string().describe("A short description of the recipe.").optional(),
  ingredients: z.array(z.string()).describe("A list of ingredients for the recipe."),
  steps: z.array(z.string()).describe("Step-by-step instructions for preparing the recipe."),
  time: z
    .object({
      prep: z.string().describe("Preparation time (e.g. '10 mins').").optional(),
      cook: z.string().describe("Cooking time (e.g. '20 mins').").optional(),
      total: z.string().describe("Total time (e.g. '30 mins').").optional(),
    })
    .partial()
    .describe("Time durations related to the recipe. All fields optional.")
    .optional(),
  servings: z.string().describe("Number of servings (e.g. 'Serves 4').").optional(),
  notes: z.array(z.string()).describe("Additional notes or tips for the recipe.").optional(),
  image: z.string().url().describe("A URL to an image of the finished dish.").optional(),
});

export const TickerSchema = z.object({
  type: z.literal("ticker"),
  useCase: z
    .enum([
      "equity",
      "etf",
      "index",
      "crypto",
      "future",
      "option",
      "forex",
      "bond",
      "mutual_fund",
      "other",
    ])
    .describe(
      "The use case or type of security for the stock ticker, e.g., equity, etf, index, crypto, bond, etc."
    ),
  symbol: z.string().describe("The ticker symbol of the stock, e.g., 'AAPL' for Apple Inc."),
  name: z
    .string()
    .describe("The full company name associated with the ticker, e.g., 'Apple Inc.'.")
    .optional(),
  currentPrice: z.number().describe("The latest price of one share of the stock."),
  previousClose: z.number().describe("The previous closing price of the stock.").optional(),
  currency: z
    .string()
    .describe("The currency in which the stock is traded, e.g., 'USD'.")
    .optional(),
  market: z
    .string()
    .describe("The market or exchange the stock trades on, e.g., 'NASDAQ', 'NYSE'.")
    .optional(),
  change: z.number().describe("The net change in price since previous close.").optional(),
  percentChange: z
    .number()
    .describe("The percent change in price since previous close.")
    .optional(),
  updatedAt: z
    .string()
    .datetime()
    .describe("The ISO8601 timestamp of when the data was last updated.")
    .optional(),
});

/**
 * TODO, replace z.any in messages with Zod schema for UIMessage
 */
export const ContextSchema = z.object({
  prompt: z.string().describe("The system prompt for the LLM."),
  messages: z.array(z.any()).describe("The messages to send to the LLM."),
  persistedSchemas: z
    .array(
      z.discriminatedUnion("type", [
        ListSchema,
        KeyValueSchema,
        CodeBlockSchema,
        RecipeCardSchema,
        TickerSchema,
      ])
    )
    .max(MAX_PERSISTED_SCHEMAS)
    .optional()
    .describe("The schemas to persist in the context. Each is optional."),
});

/**
 * Schema for context portion that will be combined into the prompt for LLM call
 */
export const ContextPieceSchema = z.object({
  title: z.string().describe("The title of the context piece.").max(100).optional(),
  content: z.string().describe("The content of the context piece.").max(10000),
});

export type Context = z.infer<typeof ContextSchema>;
export type ContextPiece = z.infer<typeof ContextPieceSchema>;
