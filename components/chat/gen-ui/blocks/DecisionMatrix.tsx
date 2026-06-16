"use client";

import type { DecisionMatrixBlock, MatrixScoreValue } from "@/lib/schemas/gen-ui";

import { computeWeightedTotals, scoreValueToNumeric } from "../lib/decision-matrix-math";

import { formatMatrixScoreValue } from "@/lib/schemas/gen-ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { cn } from "@/lib/utils";

function cellHeatmapClass(value: MatrixScoreValue): string {
  const n = scoreValueToNumeric(value);
  const t = (n - 1) / 4;

  if (value === "✓") return "bg-emerald-500/25 text-emerald-800 dark:text-emerald-200";
  if (value === "✗") return "bg-red-500/25 text-red-800 dark:text-red-200";
  if (value === "~") return "bg-amber-500/20 text-amber-900 dark:text-amber-100";
  if (t >= 0.75) return "bg-emerald-500/20";
  if (t <= 0.25) return "bg-red-500/20";

  return "bg-amber-500/15";
}

type DecisionMatrixProps = {
  block: DecisionMatrixBlock;
  partial?: boolean;
};

function MatrixCell({ value, note }: { value: MatrixScoreValue; note?: string }) {
  const inner = (
    <span
      className={cn(
        "inline-flex min-w-[2rem] items-center justify-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
        cellHeatmapClass(value)
      )}
    >
      {formatMatrixScoreValue(value)}
    </span>
  );

  if (!note?.trim()) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="cursor-help">
          {inner}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {note}
      </TooltipContent>
    </Tooltip>
  );
}

export function DecisionMatrix({ block, partial }: DecisionMatrixProps) {
  const totals = computeWeightedTotals(block);
  const recommendedId = block.recommendation?.optionId;

  return (
    <div className="space-y-3">
      <div className="hidden sm:block overflow-x-auto max-h-[min(70vh,480px)]">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <caption className="sr-only">{block.question}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-background border-b border-border/50 p-2 text-left font-medium text-foreground min-w-[120px]"
              >
                {block.question}
              </th>
              {block.criteria.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className="sticky top-0 z-10 bg-background border-b border-border/50 p-2 text-center font-medium text-muted-foreground min-w-[72px]"
                >
                  {c.label}
                  {c.weight != null ? (
                    <span className="block text-[10px] font-normal opacity-70">w{c.weight}</span>
                  ) : null}
                </th>
              ))}
              {totals ? (
                <th
                  scope="col"
                  className="sticky top-0 z-10 bg-background border-b border-border/50 p-2 text-center text-xs font-medium text-muted-foreground"
                >
                  Total
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {block.options.map((opt) => {
              const isRec = opt.id === recommendedId;

              return (
                <tr
                  key={opt.id}
                  className={cn(isRec && "ring-1 ring-inset ring-primary/40 rounded-lg")}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background border-b border-border/30 p-2 text-left font-medium text-foreground"
                  >
                    <span className="flex flex-col gap-0.5">
                      {opt.name}
                      {isRec ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Recommended
                        </span>
                      ) : null}
                      {opt.note ? (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {opt.note}
                        </span>
                      ) : null}
                    </span>
                  </th>
                  {block.criteria.map((c) => {
                    const cell = block.scores[opt.id]?.[c.id];

                    return (
                      <td
                        key={c.id}
                        className="border-b border-border/30 p-2 text-center align-middle"
                      >
                        {cell ? (
                          <MatrixCell value={cell.value} note={cell.note} />
                        ) : partial ? (
                          <span className="inline-block h-6 w-8 rounded bg-muted/40 animate-pulse" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  {totals ? (
                    <td className="border-b border-border/30 p-2 text-center text-xs font-medium tabular-nums">
                      {totals[opt.id]?.toFixed(1) ?? "—"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-3">
        <p className="text-sm font-medium text-foreground">{block.question}</p>
        {block.options.map((opt) => {
          const isRec = opt.id === recommendedId;

          return (
            <div
              key={opt.id}
              className={cn(
                "rounded-lg border border-border/50 bg-background-tertiary/20 p-3 space-y-2",
                isRec && "ring-1 ring-primary/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{opt.name}</span>
                {isRec ? (
                  <span className="text-[10px] font-semibold uppercase text-primary">
                    Recommended
                  </span>
                ) : null}
              </div>
              {block.criteria.map((c) => {
                const cell = block.scores[opt.id]?.[c.id];

                return (
                  <div key={c.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-muted-foreground">{c.label}</span>
                    {cell ? <MatrixCell value={cell.value} note={cell.note} /> : <span>—</span>}
                  </div>
                );
              })}
              {totals ? (
                <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                  Weighted total: <strong>{totals[opt.id]?.toFixed(1) ?? "—"}</strong>
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {block.recommendation ? (
        <p className="text-sm text-muted-foreground border-t border-border/30 pt-2">
          <span className="font-medium text-foreground">Rationale: </span>
          {block.recommendation.rationale}
        </p>
      ) : null}
    </div>
  );
}
