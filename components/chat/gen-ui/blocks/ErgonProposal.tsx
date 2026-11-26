"use client";

import type { LucideIcon } from "lucide-react";
import type {
  ErgonChange,
  ErgonProposalBlock as ErgonProposalBlockData,
} from "@/lib/schemas/gen-ui";

import { useRef, useState } from "react";
import { Check, MessageSquare, Pencil, Plus } from "lucide-react";

import { ErgonProposalView } from "../ergon/ErgonProposalView";
import { Chip } from "../ergon/primitives";

import { GrowToggle } from "@/components/chat/gen-ui/GrowToggle";
import { genUiActionClass } from "@/components/chat/gen-ui/interaction";
import { cn } from "@/lib/utils";

type ErgonProposalProps = {
  block: ErgonProposalBlockData;
  partial?: boolean;
  apply?: () => Promise<void>;
  /** Change rows as op-coloured chips with issue-id badges; Apply and Dismiss stay one tap away. */
  condensed?: boolean;
};

const BUTTON_FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

/** Op vocabulary for the condensed view: a shape and a tone, with the word spoken alongside. */
const OP: Record<ErgonChange["op"], { icon: LucideIcon; tone: string; word: string }> = {
  create: { icon: Plus, tone: "bg-accent/20 text-foreground", word: "Create" },
  update: { icon: Pencil, tone: "bg-muted/60 text-muted-foreground", word: "Update" },
  complete: { icon: Check, tone: "bg-accent-warm/20 text-accent-warm", word: "Complete" },
  comment: { icon: MessageSquare, tone: "bg-muted/60 text-muted-foreground", word: "Comment" },
};

const OP_ORDER: ErgonChange["op"][] = ["create", "update", "complete", "comment"];

/** Rows shown before the rest fold behind a disclosure. */
const VISIBLE_CHANGES = 4;

function OpMark({ op }: { op: ErgonChange["op"] }) {
  const { icon: Icon, tone } = OP[op];

  return (
    <span
      aria-hidden
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", tone)}
    >
      <Icon className="size-3" />
    </span>
  );
}

function ChangeRow({ change }: { change: ErgonChange }) {
  return (
    <li className="flex min-w-0 items-center gap-inline-sm rounded-xl bg-muted/40 p-inset-sm">
      <OpMark op={change.op} />
      <span className="sr-only">{OP[change.op].word}</span>
      {change.targetId ? <Chip>{change.targetId}</Chip> : null}
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{change.title}</span>
      {change.fields.length > 0 ? (
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
          {change.fields.length} {change.fields.length === 1 ? "field" : "fields"}
        </span>
      ) : null}
    </li>
  );
}

function ErgonProposalCondensed({
  block,
  apply,
}: {
  block: ErgonProposalBlockData;
  apply?: () => Promise<void>;
}) {
  const [status, setStatus] = useState<"ready" | "applying" | "applied" | "dismissed" | "error">(
    "ready"
  );
  const inFlight = useRef(false);
  const [showAll, setShowAll] = useState(false);

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

  const counts = OP_ORDER.map((op) => ({
    op,
    count: block.changes.filter((change) => change.op === op).length,
  })).filter(({ count }) => count > 0);
  const visible = block.changes.slice(0, VISIBLE_CHANGES);
  const hidden = block.changes.slice(VISIBLE_CHANGES);

  return (
    <section className="mx-auto w-full max-w-sm space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
      <header className="flex flex-wrap items-center gap-inline-sm">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {block.title}
        </h3>
        <ul
          className="flex shrink-0 items-center gap-inline-xs"
          aria-label={`${block.changes.length} proposed ${block.changes.length === 1 ? "change" : "changes"}`}
        >
          {counts.map(({ op, count }) => (
            <li key={op} className="flex items-center gap-inline-xs text-2xs tabular-nums">
              <OpMark op={op} />
              <span aria-hidden>{count}</span>
              <span className="sr-only">
                {count} {OP[op].word.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </header>

      {/* Hidden changes continue the same list, in place. */}
      <div>
        <ul className="space-y-stack-xs">
          {(showAll ? [...visible, ...hidden] : visible).map((change) => (
            <ChangeRow key={change.id} change={change} />
          ))}
        </ul>
        {hidden.length > 0 ? (
          <GrowToggle
            expanded={showAll}
            more={hidden.length}
            onToggle={() => setShowAll((v) => !v)}
          />
        ) : null}
      </div>

      <div role="status" className="text-xs text-muted-foreground">
        {status === "applying" ? "Applying…" : null}
        {status === "applied" ? "Applied." : null}
        {status === "error" ? "Couldn’t confirm the result. Refresh Ergon before retrying." : null}
        {status === "ready" && !apply ? "Preview only. No changes will be written." : null}
      </div>

      {status === "ready" ? (
        <div className="flex flex-wrap gap-inline-sm">
          {apply ? (
            <button
              type="button"
              onClick={() => void approve()}
              className={cn(genUiActionClass(), BUTTON_FOCUS)}
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

export function ErgonProposal({ block, partial, apply, condensed = false }: ErgonProposalProps) {
  if (condensed) return <ErgonProposalCondensed block={block} apply={apply} />;

  return <ErgonProposalView block={block} partial={partial} apply={apply} />;
}
