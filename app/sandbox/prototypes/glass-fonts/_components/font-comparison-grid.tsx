"use client";

import { FONT_FAMILIES, type FontFamilyId } from "../_lib/font-axes";

import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const chips = ["Memory", "Reasoning", "Search", "Voice"];

function FontColumn({
  familyId,
  className,
  name,
  note,
  isDraft,
  isLocked,
}: {
  familyId: FontFamilyId;
  className: string;
  name: string;
  note: string;
  isDraft: boolean;
  isLocked: boolean;
}) {
  return (
    <article
      className={cn(
        glassPreview({ depth: "floating", interactive: true }),
        className,
        "relative flex min-h-[44rem] flex-col rounded-[2rem] p-5 sm:p-6",
        isDraft && "ring-2 ring-accent/40",
        isLocked && "shadow-[0_22px_76px_-36px_rgba(18,140,116,0.45)]"
      )}
      data-dim-background
      data-family={familyId}
    >
      <div className="pointer-events-none absolute -inset-8 rounded-[inherit] bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.32),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(18,140,116,0.16),transparent_30%)] opacity-60 dark:opacity-42" />
      <div className="pointer-events-none absolute inset-px rounded-[inherit] bg-[linear-gradient(118deg,rgba(255,255,255,0.36),transparent_24%,transparent_70%,rgba(18,140,116,0.10))] opacity-45 dark:opacity-25" />

      <div className="relative z-10 flex h-full flex-col">
        <header className="mb-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent/80">
                Organic Glass v2
              </p>
              <h2 className="mt-2 text-3xl font-light tracking-[-0.04em] text-foreground">
                {name}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-1">
              {isDraft ? (
                <span className="rounded-full border border-accent/30 bg-accent/12 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-accent">
                  Draft
                </span>
              ) : null}
              {isLocked ? (
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                  Locked
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{note}</p>
        </header>

        <section className="mb-8">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Headline
          </p>
          <h3 className="text-4xl font-light leading-[0.98] tracking-[-0.055em] text-foreground">
            A chat surface that feels alive, calm, and precise.
          </h3>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Organic LLM turns memory, tools, and conversation into a focused workspace that stays
            readable over the living chrome field.
          </p>
        </section>

        <section className="mb-8 rounded-3xl border border-white/24 bg-background/34 p-4 shadow-inner backdrop-blur-sm dark:border-white/10 dark:bg-background-secondary/34">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Chat shell
          </p>
          <div className="flex items-center justify-between gap-4">
            <p className="min-w-0 text-sm text-foreground">What should we remember about this?</p>
            <button
              className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:scale-[1.02] active:scale-[0.98]"
              type="button"
            >
              Send
            </button>
          </div>
        </section>

        <section className="mb-8">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Controls
          </p>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                className="rounded-full border border-white/25 bg-background/36 px-3 py-1.5 text-xs font-medium text-foreground shadow-inner dark:border-white/10 dark:bg-background-secondary/36"
                key={chip}
              >
                {chip}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-auto rounded-3xl border border-white/18 bg-background/26 p-4 dark:border-white/10 dark:bg-background-secondary/26">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Dense reading sample
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            The best font for Organic Glass should keep small metadata crisp, make long assistant
            responses comfortable, and still give product moments enough character to feel
            intentional.
          </p>
        </section>
      </div>
    </article>
  );
}

export function FontComparisonGrid({
  draftFamily,
  lockedFamily,
}: {
  draftFamily: FontFamilyId;
  lockedFamily: FontFamilyId;
}) {
  return (
    <div className="grid flex-1 gap-4 lg:grid-cols-3">
      {FONT_FAMILIES.map((font) => (
        <FontColumn
          className={font.className}
          familyId={font.id}
          isDraft={draftFamily === font.id}
          isLocked={lockedFamily === font.id}
          key={font.id}
          name={font.name}
          note={font.note}
        />
      ))}
    </div>
  );
}
