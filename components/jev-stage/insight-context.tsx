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
      <section aria-label="Model inputs" className="space-y-2">
        <h3 className="font-medium">Model inputs</h3>
        {trace.contexts.length === 0 ? (
          <p className="text-2xs text-muted-foreground">No context was recorded for this turn.</p>
        ) : null}
        {[...trace.contexts].reverse().map(({ hopId, model, manifest }, index) => {
          const hop = trace.hops.find((item) => item.hopId === hopId);
          const call =
            hop?.call ??
            (hopId === "jev" ? calls.find((item) => item.operation === "jev.route") : null);

          return (
            <details key={hopId} open={index === 0}>
              <summary className="organic-focus cursor-pointer wrap-anywhere">
                <strong className="font-medium">
                  {hop?.operation === "design" ? "Designer" : (hop?.operation ?? "Jev")}
                </strong>{" "}
                · {shortModel(model)} · {manifest.segments.length} inputs
              </summary>
              {call && (
                <div className="my-1 flex flex-wrap gap-x-2 tabular-nums text-muted-foreground">
                  <span>{call.inputTokens.toLocaleString()} in</span>
                  <span>{call.outputTokens.toLocaleString()} out</span>
                  <span>{call.cachedInputTokens.toLocaleString()} cached</span>
                  <span>{formatTraceUsd(call.costUsd)}</span>
                </div>
              )}
              {manifest.window && (
                <p className="my-1 text-2xs text-muted-foreground">
                  {manifest.window.kept}/{manifest.window.total} recent messages included
                  {manifest.window.budgetUsd != null &&
                    ` · ${formatTraceUsd(manifest.window.budgetUsd)} packing budget`}
                </p>
              )}
              <div className="space-y-1 border-l border-border/50 pl-2">
                {manifest.segments.map((segment, index) => (
                  <details key={index} className="group py-1">
                    <summary className="organic-focus cursor-pointer wrap-anywhere">
                      {segment.label}
                      {segment.role && ` · ${segment.role}`}{" "}
                      <span className="tabular-nums text-muted-foreground">
                        · ~{segment.tokens.toLocaleString()} tokens
                      </span>
                      {segment.preview && (
                        <span className="ml-3 line-clamp-1 text-2xs text-muted-foreground group-open:hidden">
                          {segment.preview}
                        </span>
                      )}
                    </summary>
                    <p className="mt-1 text-2xs whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                      {segment.text}
                    </p>
                    {segment.truncated && (
                      <p className="text-2xs text-muted-foreground">Stored preview truncated</p>
                    )}
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
                          <p className="mt-1 text-2xs whitespace-pre-wrap wrap-anywhere text-muted-foreground">
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
      {calls.length > 0 && (
        <section aria-label="Model usage" className="space-y-2">
          <h3 className="font-medium">Model usage</h3>
          <p className="text-2xs text-muted-foreground">
            Cache hits are per call. Cost estimates use the app’s rates.
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
    </div>
  );
}
