"use client";

import type { ErgonProposalBlock } from "@/lib/schemas/gen-ui";

import { useRef, useState } from "react";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type Apply = () => Promise<void>;

const BUTTON_FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type ErgonProposalViewProps = {
  block: ErgonProposalBlock;
  partial?: boolean;
  /**
   * Host-owned write path. Without it the card is preview-only — never send
   * proposed fields through a chat turn (values would be dropped).
   */
  apply?: Apply;
};

export function ErgonProposalView({ block, apply }: ErgonProposalViewProps) {
  const [status, setStatus] = useState<
    "ready" | "applying" | "applied" | "dismissed" | "error"
  >("ready");
  const inFlight = useRef(false);

  async function approve() {
    if (!apply || status !== "ready" || inFlight.current) return;
    inFlight.current = true;
    setStatus("applying");
    try {
      await apply();
      setStatus("applied");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  if (status === "dismissed") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Proposal dismissed.
      </p>
    );
  }

  return (
    <section className={cn("rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>
      <ul className={spacing.card.blockItems}>
        {block.changes.map((change) => (
          <li key={change.id} className="rounded-xl bg-muted/40 p-inset-md text-sm">
            <p className="text-xs text-muted-foreground">
              {change.op}
              {change.targetId ? ` · ${change.targetId}` : ""}
            </p>
            <p className="break-words text-foreground">{change.title}</p>
            {change.fields.length > 0 ? (
              <dl className="mt-stack-sm space-y-stack-xs">
                {change.fields.map((field, i) => (
                  <div key={`${field.name}:${i}`} className="break-words text-xs">
                    <dt className="text-muted-foreground">{field.name}</dt>
                    <dd className="text-foreground">
                      {field.from !== undefined ? (
                        <>
                          <del>{field.from}</del>
                          {" → "}
                        </>
                      ) : null}
                      <span>{field.to}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>

      <div role="status" className="text-sm text-muted-foreground">
        {status === "applying" ? "Applying…" : null}
        {status === "applied" ? "Applied." : null}
        {status === "error"
          ? "Couldn’t confirm the result. Refresh Ergon before retrying."
          : null}
        {status === "ready" && !apply ? "Preview only. No changes will be written." : null}
      </div>

      {status === "ready" ? (
        <div className="flex flex-wrap gap-inline-sm">
          {apply ? (
            <button
              type="button"
              onClick={() => void approve()}
              className={cn(
                "min-h-11 rounded-lg bg-accent-warm px-inset-md text-sm font-medium text-accent-foreground",
                BUTTON_FOCUS
              )}
            >
              Apply changes
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setStatus("dismissed")}
            className={cn(
              "min-h-11 rounded-lg border border-border/60 px-inset-md text-sm text-muted-foreground",
              BUTTON_FOCUS
            )}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </section>
  );
}
