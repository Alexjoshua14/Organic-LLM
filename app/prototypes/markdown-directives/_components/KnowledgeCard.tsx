"use client";

import { useEffect, useState } from "react";
import type { DirectiveProps } from "../_lib/componentRegistry";
import { resolveDirectiveData } from "../_lib/mockResolver";

/**
 * Example directive component. Renders a small card of "knowledge" resolved from
 * mockResolver using the directive props (e.g. query, limit, view).
 */
export function KnowledgeCard(props: DirectiveProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveDirectiveData("knowledge-card", props).then((resolved) => {
      if (!cancelled) setData(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [props.query, props.limit, props.view]);

  if (!data) return <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">Loading…</div>;
  const title = (data.title as string) ?? "Knowledge";
  const items = (data.items as { label: string; date: string }[]) ?? [];
  return (
    <div className="my-2 rounded border border-border bg-muted/30 p-3">
      <div className="font-medium text-foreground">{title}</div>
      <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item.label} — {item.date}</li>
        ))}
      </ul>
    </div>
  );
}
