import type { ReactNode } from "react";
import type { GenUIBlock, RestaurantCardBlock } from "@/lib/schemas/gen-ui";

import { Star } from "lucide-react";
import { useState } from "react";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";
import { AudioSnippet } from "@/components/chat/gen-ui/blocks/AudioSnippet";
import { ShoppingList } from "@/components/chat/gen-ui/blocks/ShoppingList";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import { PromptField } from "@/components/chat/gen-ui/blocks/PromptField";
import { codeDiffTitle } from "@/lib/schemas/gen-ui/code-diff";
import { recipeIngredientToText } from "@/lib/schemas/gen-ui/recipe-card";
import { MeasureView } from "@/components/chat/gen-ui/measure/MeasureView";

function GenUiCondensedRestaurant({ block }: { block: RestaurantCardBlock }) {
  return (
    <article className="mx-auto w-full max-w-xs space-y-stack-xs">
      <div className="flex items-baseline justify-between gap-inline-sm">
        <h3 className="min-w-0 text-sm font-semibold wrap-anywhere">{block.name}</h3>
        {block.rating ? (
          <p className="inline-flex shrink-0 items-center gap-inline-xs text-xs tabular-nums text-muted-foreground">
            <Star aria-hidden className="size-3" />
            <span>{block.rating.average.toFixed(1)} / 5</span>
          </p>
        ) : null}
      </div>
      {block.address ? (
        <p className="text-xs wrap-anywhere text-muted-foreground">{block.address}</p>
      ) : null}
    </article>
  );
}

/** Common heading and reading width for text-led previews. Visualizations own their layout. */
export function CondensedCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-sm space-y-stack-sm text-sm wrap-anywhere">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </article>
  );
}

/** Keeps the primary result visible and mounts secondary content when the reader opens it. */
export function CondensedDetail({ label, children }: { label: string; children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <details
      className="border-t border-border/60 pt-inset-sm"
      onToggle={(event) => {
        if (event.currentTarget.open) setRevealed(true);
      }}
    >
      <summary className="organic-focus cursor-pointer text-xs font-medium">{label}</summary>
      {revealed ? <div className="mt-stack-sm min-w-0">{children}</div> : null}
    </details>
  );
}

function Lines({ items, more }: { items: readonly ReactNode[]; more: string }) {
  function list(entries: readonly ReactNode[]) {
    return (
      <ul className="space-y-stack-xs text-xs">
        {entries.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {list(items.slice(0, 3))}
      {items.length > 3 ? (
        <CondensedDetail label={`${items.length - 3} more ${more}`}>
          {list(items.slice(3))}
        </CondensedDetail>
      ) : null}
    </>
  );
}

function StatusLine({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function GenUiCondensedBlock({
  block,
  children,
}: {
  block: GenUIBlock;
  children?: ReactNode;
}) {
  switch (block.type) {
    case "restaurant-card":
      return <GenUiCondensedRestaurant block={block} />;
    case "measure":
      return <MeasureView block={block} condensed />;
    case "decision-matrix":
      // The decision demo owns criterion selection.
      return children;
    case "answer-card":
      return (
        <CondensedCard title={block.title}>
          <GenUIMarkdown>{block.tldr}</GenUIMarkdown>
          <Lines items={block.keyPoints} more="key points" />
          {block.footer && <StatusLine>Confidence: {block.footer.confidence}</StatusLine>}
          {block.footer?.caveats?.length ? (
            <CondensedDetail label="Caveats">
              <Lines items={block.footer.caveats} more="caveats" />
            </CondensedDetail>
          ) : null}
        </CondensedCard>
      );
    case "plan-timeline":
      return (
        <div className="mx-auto w-full max-w-sm">
          <PlanTimeline block={block} variant="condensed" />
        </div>
      );
    case "audio-snippet":
      return (
        <div className="mx-auto w-full max-w-sm">
          <AudioSnippet block={block} condensed />
        </div>
      );
    case "recipe-card":
      return (
        <CondensedCard title={block.title}>
          <StatusLine>
            {[block.servings, block.duration || block.cookTime].filter(Boolean).join(" · ") ||
              `${block.ingredients.length} ingredients`}
          </StatusLine>
          <CondensedDetail label={`Ingredients · ${block.ingredients.length}`}>
            <Lines items={block.ingredients.map(recipeIngredientToText)} more="ingredients" />
          </CondensedDetail>
          <CondensedDetail label={`Method · ${block.steps.length} steps`}>
            <ol className="list-inside list-decimal space-y-stack-xs text-xs">
              {block.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </CondensedDetail>
        </CondensedCard>
      );
    case "shopping-list":
      return (
        <div className="mx-auto w-full max-w-sm">
          <ShoppingList block={block} condensed />
        </div>
      );
    case "research-report":
      return (
        <CondensedCard title={block.title}>
          <GenUIMarkdown>{block.summary}</GenUIMarkdown>
          <StatusLine>
            {block.sources.length} sources · {block.claims.length} assessed claims
          </StatusLine>
          {block.limitations.length > 0 && (
            <CondensedDetail label="Limitations">
              <Lines items={block.limitations} more="limitations" />
            </CondensedDetail>
          )}
          <CondensedDetail label="Inspect evidence">{children}</CondensedDetail>
        </CondensedCard>
      );
    case "profile-map":
      return (
        <CondensedCard title={block.title}>
          <Lines
            items={block.domains.map(({ id, label }) => {
              const nodes = block.nodes.filter((node) => node.domain === id);

              return (
                <>
                  <strong>{label}</strong>:{" "}
                  {nodes
                    .slice(0, 2)
                    .map(({ title }) => title)
                    .join(", ") || "No entries"}
                  {nodes.length > 2 ? ` · +${nodes.length - 2}` : ""}
                </>
              );
            })}
            more="domains"
          />
          <CondensedDetail label="Explore relationships">{children}</CondensedDetail>
        </CondensedCard>
      );
    case "ergon-board":
      return (
        <CondensedCard title={block.title}>
          <Lines
            items={block.columns.map(({ id, label }) => {
              const items = block.items.filter(({ stateType }) => stateType === id);

              return (
                <>
                  <strong>
                    {label} · {items.length}
                  </strong>
                  {items[0] ? `: ${items[0].title}` : ""}
                </>
              );
            })}
            more="statuses"
          />
          <CondensedDetail label="Open work items">{children}</CondensedDetail>
        </CondensedCard>
      );
    case "ergon-proposal":
      return (
        <CondensedCard title={block.title}>
          <StatusLine>
            {block.changes.length} proposed {block.changes.length === 1 ? "change" : "changes"}
          </StatusLine>
          <Lines
            items={block.changes.map(({ op, title, targetId }) => (
              <>
                <span className="capitalize">{op}</span> · {targetId ? `${targetId} · ` : ""}
                {title}
              </>
            ))}
            more="proposed changes"
          />
          <CondensedDetail label="Review proposed changes">{children}</CondensedDetail>
        </CondensedCard>
      );
    case "state-diagram": {
      const names = new Map(block.states.map(({ id, label }) => [id, label]));

      return (
        <CondensedCard title={block.title}>
          <Lines
            items={block.transitions.map(({ from, to, label }) => (
              <>
                {names.get(from)} → {names.get(to)}
                {label ? ` · ${label}` : ""}
              </>
            ))}
            more="transitions"
          />
          {block.transitions.length === 0 && (
            <StatusLine>{block.states.map(({ label }) => label).join(", ")}</StatusLine>
          )}
        </CondensedCard>
      );
    }
    case "prompt-field":
      return (
        <div className="mx-auto w-full max-w-sm">
          <PromptField block={block} condensed />
        </div>
      );
    case "progress-track": {
      const next = block.milestones
        .filter(({ value }) => value > block.current)
        .sort((a, b) => a.value - b.value)[0];

      return (
        <CondensedCard title={block.title}>
          <p className="font-mono tabular-nums">
            {block.current} / {block.total}
            {block.unit ? ` ${block.unit}` : ""}
          </p>
          <progress
            aria-label={block.title}
            value={block.current}
            max={block.total}
            className="block h-2 w-full accent-accent"
          />
          {next && (
            <StatusLine>
              Next: {next.label} at {next.value}
            </StatusLine>
          )}
          {block.footnote && <StatusLine>{block.footnote}</StatusLine>}
        </CondensedCard>
      );
    }
    case "context-switchboard":
      return (
        <CondensedCard title={block.title}>
          {block.question && <p>{block.question}</p>}
          <StatusLine>
            {block.items.filter(({ included }) => included).length} of {block.items.length} sources
            included
          </StatusLine>
          <Lines
            items={block.items.map(({ label, included }) => (
              <>
                {label} · {included ? "Included" : "Excluded"}
              </>
            ))}
            more="sources"
          />
          <CondensedDetail label="Adjust context">{children}</CondensedDetail>
        </CondensedCard>
      );
    case "ripple-preview":
      return (
        <CondensedCard title={block.title}>
          <p>{block.change.summary}</p>
          <Lines
            items={block.ripples.map(({ label, kind }) => (
              <>
                <span className="capitalize">{kind}</span> · {label}
              </>
            ))}
            more="effects"
          />
          <CondensedDetail label="Review effects">{children}</CondensedDetail>
        </CondensedCard>
      );
    case "hyp-graph": {
      const names = new Map(block.nodes.map(({ id, label }) => [id, label]));

      return (
        <CondensedCard title={block.title}>
          <Lines
            items={block.edges.map(({ from, to, label }) => (
              <>
                {names.get(from)} → {names.get(to)}
                {label ? ` · ${label}` : ""}
              </>
            ))}
            more="connections"
          />
          {block.edges.length === 0 && (
            <StatusLine>{block.nodes.map(({ label }) => label).join(", ")}</StatusLine>
          )}
        </CondensedCard>
      );
    }
    case "audit-line":
      return (
        <CondensedCard title={block.title}>
          <Lines
            items={block.events.map(({ time, actor, action, summary }) => (
              <>
                <strong>{action}</strong> · {actor} · {time}
                <br />
                {summary}
              </>
            ))}
            more="events"
          />
        </CondensedCard>
      );
    case "preview-blob":
      return (
        <CondensedCard title={block.title}>
          <a
            className="organic-focus block"
            href={block.svgURL ?? block.previewURL}
            target="_blank"
            rel="noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- This is a schema-validated remote preview URL. */}
            <img
              src={block.previewURL}
              alt={`Open ${block.title} preview`}
              className="mx-auto max-h-32 max-w-full object-contain"
              loading="lazy"
            />
          </a>
          {block.costEstimate && <StatusLine>{block.costEstimate}</StatusLine>}
        </CondensedCard>
      );
    case "code-diff":
      return (
        <CondensedCard title={codeDiffTitle(block)}>
          {block.summary && <p>{block.summary}</p>}
          <Lines
            items={block.files.map(({ path, status }) => (
              <>
                <code className="wrap-anywhere">{path}</code>
                {status ? ` · ${status}` : ""}
              </>
            ))}
            more="files"
          />
          <CondensedDetail label="Read changed lines">{children}</CondensedDetail>
        </CondensedCard>
      );
  }
}
