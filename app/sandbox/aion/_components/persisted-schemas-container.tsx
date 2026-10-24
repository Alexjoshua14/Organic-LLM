"use client";

import { z } from "zod";

import {
  ListRenderer,
  KeyValueRenderer,
  CodeBlockRenderer,
  RecipeCardRenderer,
  TickerRenderer,
} from "./schema-renderers";

import {
  ListSchema,
  KeyValueSchema,
  CodeBlockSchema,
  RecipeCardSchema,
  TickerSchema,
} from "@/lib/schemas/llm-context";

// Zod union for any persisted schema type
export const PersistedSchema = z.union([
  ListSchema,
  KeyValueSchema,
  CodeBlockSchema,
  RecipeCardSchema,
  TickerSchema,
]);

export type PersistedSchemaType =
  | z.infer<typeof ListSchema>
  | z.infer<typeof KeyValueSchema>
  | z.infer<typeof CodeBlockSchema>
  | z.infer<typeof RecipeCardSchema>
  | z.infer<typeof TickerSchema>;

type PersistedSchemasContainerProps = {
  schemas?: PersistedSchemaType[];
};

export function PersistedSchemasContainer({ schemas = [] }: PersistedSchemasContainerProps) {
  if (schemas.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-foreground/40 text-sm">
        No persisted schemas yet
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-4 space-y-4">
      {schemas.map((schema, idx) => {
        switch (schema.type) {
          case "list":
            return <ListRenderer key={idx} schema={schema} />;
          case "keyValue":
            return <KeyValueRenderer key={idx} schema={schema} />;
          case "codeBlock":
            return <CodeBlockRenderer key={idx} schema={schema} />;
          case "recipeCard":
            return <RecipeCardRenderer key={idx} schema={schema} />;
          case "ticker":
            return <TickerRenderer key={idx} schema={schema} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
