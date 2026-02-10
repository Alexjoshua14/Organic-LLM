"use client";

import { useEffect, useState } from "react";
import type { DirectiveProps } from "../_lib/componentRegistry";
import { resolveDirectiveData } from "../_lib/mockResolver";

/**
 * Example directive component. Renders a simple table from mock data.
 */
export function DataTable(props: DirectiveProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveDirectiveData("data-table", props).then((resolved) => {
      if (!cancelled) setData(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <div className="text-sm text-muted-foreground">Loading table…</div>;
  const columns = (data.columns as string[]) ?? [];
  const rows = (data.rows as (string | number)[][]) ?? [];
  return (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="border border-border bg-muted/50 px-2 py-1 text-left font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-border px-2 py-1">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
