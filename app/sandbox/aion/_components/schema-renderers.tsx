"use client";

import {
  ListSchema,
  KeyValueSchema,
  CodeBlockSchema,
  RecipeCardSchema,
  TickerSchema,
} from "@/lib/schemas/llm-context";
import { z } from "zod";

type ListSchemaType = z.infer<typeof ListSchema>;
type KeyValueSchemaType = z.infer<typeof KeyValueSchema>;
type CodeBlockSchemaType = z.infer<typeof CodeBlockSchema>;
type RecipeCardSchemaType = z.infer<typeof RecipeCardSchema>;
type TickerSchemaType = z.infer<typeof TickerSchema>;

export function ListRenderer({ schema }: { schema: ListSchemaType }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-background">
      <h3 className="text-sm font-semibold mb-2 capitalize">
        {schema.useCase.replace("_", " ")}
      </h3>
      <ul className="space-y-1">
        {schema.items.map((item, idx) => (
          <li key={idx} className="text-sm text-foreground/80">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KeyValueRenderer({ schema }: { schema: KeyValueSchemaType }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-background">
      <h3 className="text-sm font-semibold mb-2 capitalize">
        {schema.useCase.replace("_", " ")}
      </h3>
      <div className="space-y-1">
        <div className="text-sm">
          <span className="font-medium text-foreground/90">{schema.key}:</span>{" "}
          <span className="text-foreground/70">{schema.value}</span>
        </div>
      </div>
    </div>
  );
}

export function CodeBlockRenderer({ schema }: { schema: CodeBlockSchemaType }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold capitalize">
          {schema.useCase.replace("_", " ")}
        </h3>
        <span className="text-xs text-foreground/60 px-2 py-1 rounded bg-background-tertiary">
          {schema.language}
        </span>
      </div>
      {schema.caption && (
        <p className="text-xs text-foreground/60 mb-2">{schema.caption}</p>
      )}
      <pre className="text-xs bg-background-tertiary p-3 rounded overflow-x-auto">
        <code>{schema.code}</code>
      </pre>
    </div>
  );
}

export function RecipeCardRenderer({ schema }: { schema: RecipeCardSchemaType }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-background">
      <h3 className="text-lg font-semibold mb-2">{schema.title}</h3>
      {schema.description && (
        <p className="text-sm text-foreground/70 mb-3">{schema.description}</p>
      )}
      <div className="space-y-3">
        {schema.time && (
          <div className="text-xs text-foreground/60">
            {schema.time.prep && <span>Prep: {schema.time.prep}</span>}
            {schema.time.cook && <span className="ml-3">Cook: {schema.time.cook}</span>}
            {schema.time.total && <span className="ml-3">Total: {schema.time.total}</span>}
          </div>
        )}
        {schema.servings && (
          <div className="text-xs text-foreground/60">{schema.servings}</div>
        )}
        <div>
          <h4 className="text-sm font-medium mb-1">Ingredients:</h4>
          <ul className="text-xs space-y-1 text-foreground/80">
            {schema.ingredients.map((ingredient, idx) => (
              <li key={idx}>• {ingredient}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-1">Steps:</h4>
          <ol className="text-xs space-y-1 text-foreground/80 list-decimal list-inside">
            {schema.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
        {schema.notes && schema.notes.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Notes:</h4>
            <ul className="text-xs space-y-1 text-foreground/60">
              {schema.notes.map((note, idx) => (
                <li key={idx}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function TickerRenderer({ schema }: { schema: TickerSchemaType }) {
  const isPositive = (schema.change ?? 0) >= 0;
  const changeColor = isPositive ? "text-green-500" : "text-red-500";

  return (
    <div className="p-4 rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold">{schema.symbol}</h3>
          {schema.name && (
            <p className="text-xs text-foreground/60">{schema.name}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">
            {schema.currentPrice.toFixed(2)} {schema.currency ?? "USD"}
          </div>
          {schema.change !== undefined && (
            <div className={`text-sm ${changeColor}`}>
              {isPositive ? "+" : ""}
              {schema.change.toFixed(2)} (
              {schema.percentChange !== undefined
                ? `${isPositive ? "+" : ""}${schema.percentChange.toFixed(2)}%`
                : ""}
              )
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-foreground/60 space-y-1">
        {schema.previousClose !== undefined && (
          <div>Previous Close: {schema.previousClose.toFixed(2)}</div>
        )}
        {schema.market && <div>Market: {schema.market}</div>}
        {schema.updatedAt && (
          <div>Updated: {new Date(schema.updatedAt).toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}

