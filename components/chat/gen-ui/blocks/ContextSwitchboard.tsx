"use client";

import type { ContextBudgetSegmentId } from "@/lib/chat/context-budget";
import type {
  ContextSwitchboardBlock,
  ContextSwitchItem,
  ContextSwitchKind,
} from "@/lib/schemas/gen-ui";

import { useEffect, useMemo, useState } from "react";
import { Brain, CircleHelp, FileText, Lightbulb } from "lucide-react";

import { CompositionBar, CompositionBarDetail } from "@/components/design-system/composition-bar";
import { genUiActionClass } from "@/components/chat/gen-ui/interaction";
import { glass } from "@/components/design-system/primitives";
import { Switch } from "@/components/design-system/switch";
import { contextSegmentColor } from "@/lib/design/kelvin-color";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

/**
 * Each kind borrows the context-usage source colour it already means there, so this board and
 * the composer's context chart read as one palette: memory is memory, a file arrives in the
 * messages, an assumption is model-derived like a summary, anything else sits with the system.
 */
const KIND_META: Record<
  ContextSwitchKind,
  { label: string; Icon: typeof Brain; source: Exclude<ContextBudgetSegmentId, "free"> }
> = {
  memory: { label: "Memory", Icon: Brain, source: "memory" },
  file: { label: "File", Icon: FileText, source: "messages" },
  assumption: { label: "Assumption", Icon: Lightbulb, source: "summary" },
  other: { label: "Other", Icon: CircleHelp, source: "system" },
};

/** Colours are fixed per source; fill ratio only matters for the "free" segment, unused here. */
const kindColor = (kind: ContextSwitchKind, alpha = 1) =>
  contextSegmentColor(KIND_META[kind].source, 0, alpha);

/** Switched-off context: present in the whole, but not lit. */
const OFF_COLOR = "color-mix(in oklab, var(--muted-foreground) 35%, transparent)";

type ContextSwitchboardProps = {
  block: ContextSwitchboardBlock;
  partial?: boolean;
  /**
   * Host reruns the same turn with only the included item ids.
   * Without it the board is preview-only.
   */
  onRerun?: (included: ContextSwitchItem[]) => void | Promise<void>;
  /** Same board at a glance: composition bar, compact switch rows. Toggling still works. */
  condensed?: boolean;
};

export function ContextSwitchboard({ block, onRerun, condensed = false }: ContextSwitchboardProps) {
  const [included, setIncluded] = useState(() =>
    Object.fromEntries(block.items.map((i) => [i.id, i.included]))
  );
  const [status, setStatus] = useState<"ready" | "running" | "done" | "error">("ready");
  const [barSelection, setBarSelection] = useState<string | null>(null);

  useEffect(() => {
    setIncluded(Object.fromEntries(block.items.map((i) => [i.id, i.included])));
    setStatus("ready");
  }, [block.items]);

  const activeItems = useMemo(
    () => block.items.filter((i) => included[i.id]),
    [block.items, included]
  );
  const includedCount = activeItems.length;
  const total = block.items.length;
  const excludedCount = total - includedCount;

  const kindTally = useMemo(() => {
    const counts: Partial<Record<ContextSwitchKind, { on: number; total: number }>> = {};

    for (const item of block.items) {
      const slot = counts[item.kind] ?? { on: 0, total: 0 };

      slot.total += 1;
      if (included[item.id]) slot.on += 1;
      counts[item.kind] = slot;
    }

    return (Object.keys(KIND_META) as ContextSwitchKind[])
      .map((kind) => ({ kind, ...(counts[kind] ?? { on: 0, total: 0 }) }))
      .filter((row) => row.total > 0);
  }, [block.items, included]);

  const setOn = (id: string, on: boolean) => {
    setIncluded((prev) => ({ ...prev, [id]: on }));
    setStatus("ready");
  };

  const rerun = async () => {
    if (!onRerun || status === "running") return;
    setStatus("running");
    try {
      await onRerun(activeItems);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const selectedKind = kindTally.find((row) => row.kind === barSelection);

  /** The context-usage bar: lit share per kind, plus what is switched off. Shared by both sizes. */
  const compositionBar = (
    <div>
      <CompositionBar
        label="Context by kind"
        selectedId={barSelection}
        onSelectionChange={setBarSelection}
        segments={[
          ...kindTally.map(({ kind, on, total: kindTotal }) => ({
            id: kind,
            value: on,
            color: kindColor(kind),
            glowColor: kindColor(kind, 0.4),
            ariaLabel: `${KIND_META[kind].label}: ${on} of ${kindTotal} on`,
          })),
          {
            id: "off",
            value: excludedCount,
            color: OFF_COLOR,
            glowColor: "transparent",
            ariaLabel: `${excludedCount} off`,
          },
        ]}
      />
      <CompositionBarDetail>
        {selectedKind ? (
          <>
            <span className="block truncate text-foreground">
              {KIND_META[selectedKind.kind].label}
            </span>
            <span className="block font-mono tabular-nums">
              {selectedKind.on} of {selectedKind.total} on
            </span>
          </>
        ) : barSelection === "off" ? (
          <>
            <span className="block truncate text-foreground">Off</span>
            <span className="block">Ignored next run. Nothing is deleted.</span>
          </>
        ) : null}
      </CompositionBarDetail>
    </div>
  );

  const countBadge = (
    <p
      className="shrink-0 rounded-lg bg-muted/50 px-inset-sm py-0.5 font-mono text-xs tabular-nums text-foreground"
      aria-label={`${includedCount} of ${total} included`}
    >
      {includedCount}
      <span className="text-muted-foreground">/{total} on</span>
    </p>
  );

  const rows = (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset
    <ul
      className={condensed ? spacing.card.listItems : spacing.card.blockItems}
      role="list"
      aria-label="Context sources"
    >
      {block.items.map((item) => (
        <li key={item.id}>
          <SourceSwitch
            item={item}
            on={Boolean(included[item.id])}
            compact={condensed}
            onChange={(on) => setOn(item.id, on)}
          />
        </li>
      ))}
    </ul>
  );

  const rerunButton = onRerun ? (
    <button
      type="button"
      disabled={status === "running" || includedCount === 0}
      onClick={() => void rerun()}
      className={genUiActionClass()}
    >
      {condensed ? "Rerun" : "Rerun with selection"}
    </button>
  ) : null;

  const statusLine = (
    <>
      {status === "running" ? <span>Rerunning…</span> : null}
      {status === "done" ? <span>Rerun complete.</span> : null}
      {status === "error" ? <span className="text-destructive">Rerun failed.</span> : null}
      {!onRerun ? <span>Preview only.</span> : null}
    </>
  );

  if (condensed) {
    return (
      <section className="w-full space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
        <div className="flex items-center justify-between gap-inline-sm">
          <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{block.title}</h3>
          {countBadge}
        </div>

        {compositionBar}
        {rows}

        <div className="flex items-center justify-between gap-inline-sm">
          <span
            role="status"
            className="flex flex-wrap gap-x-inline-sm text-2xs text-muted-foreground"
          >
            {statusLine}
          </span>
          {rerunButton}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <header className="space-y-stack-sm">
        <div className="flex items-start justify-between gap-inline-md">
          <div className={cn("min-w-0", spacing.card.labelStack)}>
            <h3 className="text-sm font-medium text-foreground">{block.title}</h3>
            {block.question ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{block.question}</p>
            ) : null}
          </div>
          {countBadge}
        </div>

        {compositionBar}

        {kindTally.length > 1 ? (
          <ul className="flex flex-wrap gap-inline-xs" aria-label="By kind">
            {kindTally.map(({ kind, on, total: kindTotal }) => {
              const { Icon, label } = KIND_META[kind];

              return (
                <li
                  key={kind}
                  className="inline-flex items-center gap-inline-xs rounded-full bg-muted/50 px-inset-sm py-0.5 text-2xs text-muted-foreground"
                >
                  {/* Legend key: the same colour as this kind's bar segment. */}
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: kindColor(kind) }}
                  />
                  <Icon aria-hidden className="size-3" />
                  <span>{label}</span>
                  {/* Tabular figures: "0/1" and "1/1" are the same width, so chips never shift. */}
                  <span className="font-mono tabular-nums text-foreground">
                    {on}/{kindTotal}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </header>

      {rows}

      <div
        role="status"
        className="flex flex-wrap items-center gap-x-inline-sm gap-y-stack-xs text-xs text-muted-foreground"
      >
        <span>
          {excludedCount === 0
            ? "All context on for the next run."
            : `${excludedCount} off — ignored next run.`}
        </span>
        {statusLine}
      </div>

      {rerunButton}

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}

/**
 * One source as a row-wide glass switch: the whole row is the switch's label, so tapping
 * anywhere toggles it. The kind shows as an icon on a neutral glass tile, not a colour fill.
 */
function SourceSwitch({
  item,
  on,
  compact,
  onChange,
}: {
  item: ContextSwitchItem;
  on: boolean;
  compact: boolean;
  onChange: (on: boolean) => void;
}) {
  const { Icon, label: kindLabel } = KIND_META[item.kind];

  return (
    <Switch
      isSelected={on}
      onValueChange={onChange}
      aria-label={`${item.label} (${kindLabel})`}
      classNames={{
        base: cn(
          "flex w-full max-w-none flex-row-reverse items-center justify-between gap-inline-md rounded-xl",
          compact ? "px-inset-sm py-1.5" : "px-inset-md py-2.5",
          on ? "bg-muted/40" : "bg-muted/15"
        ),
        label: "ms-0 min-w-0 flex-1",
      }}
    >
      <span className="flex min-w-0 items-center gap-inline-md">
        <span
          aria-hidden
          className={cn(
            glass({ chip: true }),
            "flex shrink-0 items-center justify-center rounded-lg",
            compact ? "size-6" : "size-8",
            on ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Icon className={compact ? "size-3" : "size-3.5"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-inline-sm">
            <span
              className={cn(
                "truncate",
                compact ? "text-xs" : "text-sm",
                on ? "text-foreground" : "text-muted-foreground line-through"
              )}
            >
              {item.label}
            </span>
            <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
              {kindLabel}
            </span>
          </span>
          {item.detail && !compact ? (
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
              {item.detail}
            </span>
          ) : null}
        </span>
      </span>
    </Switch>
  );
}
