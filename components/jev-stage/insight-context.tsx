import type { JevStageModelCallTrace } from "@/lib/jev-stage/schema";
import type { JevTraceView } from "@/lib/jev-stage/trace-view";

import { costBreakdown } from "@/lib/jev-stage/context-manifest";
import { formatTraceUsd, hopTools, shortModel } from "@/lib/jev-stage/trace-view";

export function InsightContext({
  trace,
  calls,
}: {
  trace: JevTraceView;
  calls: JevStageModelCallTrace[];
}) {
  return (
    <div className="space-y-3 text-2xs">
      {calls.length > 0 && (
        <section aria-label="Model usage" className="space-y-2">
          <h3 className="font-medium">Model usage</h3>
          <p className="text-muted-foreground">
            Cache hits are reported per model call. Costs by token type use the app’s pricing table.
          </p>
          {calls.map((call) => {
            const { lines } = costBreakdown(call.model, call);

            return (
              <details key={call.id}>
                <summary className="organic-focus cursor-pointer wrap-anywhere">
                  {shortModel(call.model)} · {formatTraceUsd(call.costUsd)}
                </summary>
                <ul className="space-y-1 pt-1 text-muted-foreground">
                  {lines.map((line) => (
                    <li key={line.label}>
                      {line.label} · {line.tokens.toLocaleString()} tokens ·{" "}
                      {formatTraceUsd(line.usd)} ({formatTraceUsd(line.ratePerMillion)}/million)
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </section>
      )}
      <section aria-label="Model inputs" className="space-y-2">
        <h3 className="font-medium">Model inputs</h3>
        {trace.contexts.length === 0 ? (
          <p className="text-muted-foreground">No context was recorded for this turn.</p>
        ) : (
          <p className="text-muted-foreground">Token counts for individual inputs are estimates.</p>
        )}
        {trace.contexts.map(({ hopId, model, manifest }) => {
          const hop = trace.hops.find((item) => item.hopId === hopId);

          return (
            <details key={hopId}>
              <summary className="organic-focus cursor-pointer wrap-anywhere">
                {hop?.operation ?? "Jev"} · {shortModel(model)}
              </summary>
              {manifest.window && (
                <p className="my-1 text-muted-foreground">
                  {manifest.window.kept}/{manifest.window.total} recent messages included
                  {manifest.window.budgetUsd != null &&
                    ` · ${formatTraceUsd(manifest.window.budgetUsd)} packing budget`}
                </p>
              )}
              <div className="space-y-1 border-l border-border/50 pl-2">
                {manifest.segments.map((segment, index) => (
                  <details key={index} className="py-1">
                    <summary className="organic-focus cursor-pointer wrap-anywhere">
                      {segment.label}
                      {segment.role && ` · ${segment.role}`} · ~{segment.tokens.toLocaleString()}{" "}
                      tokens
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                      {segment.text}
                    </p>
                    {segment.truncated && <p>Stored preview truncated</p>}
                  </details>
                ))}
                {hop &&
                  hopTools(hop).map(
                    (tool, index) =>
                      tool.output && (
                        <details key={index} className="py-1">
                          <summary className="organic-focus cursor-pointer wrap-anywhere">
                            {tool.name} output
                          </summary>
                          <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                            {tool.output}
                          </p>
                        </details>
                      )
                  )}
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
