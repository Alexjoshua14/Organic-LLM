import type { Metadata } from "next";

import Link from "next/link";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glassPreview } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { cn } from "@/lib/utils";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Glass Fonts"),
};

const fontColumns = [
  {
    name: "Satoshi",
    className: "font-satoshi",
    note: "Default Organic LLM body voice",
  },
  {
    name: "Inter",
    className: "[font-family:var(--font-inter)]",
    note: "Neutral interface benchmark",
  },
  {
    name: "Commissioner",
    className: "font-commissioner",
    note: "Editorial display candidate",
  },
];

const chips = ["Memory", "Reasoning", "Search", "Voice"];

function FontColumn({ className, name, note }: { className: string; name: string; note: string }) {
  return (
    <article
      className={cn(
        glassPreview({ depth: "floating", interactive: true }),
        className,
        "flex min-h-[44rem] flex-col rounded-[2rem] p-5 sm:p-6"
      )}
      data-dim-background
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
            <span className="rounded-full border border-white/30 bg-background/38 px-3 py-1 text-[11px] text-muted-foreground shadow-inner dark:border-white/10 dark:bg-background-secondary/38">
              Font
            </span>
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

export default function GlassFontsPrototypePage() {
  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.68} speed={0.01} />

      <div className="relative z-10 h-full w-full overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="/sandbox/prototypes"
            >
              &larr; Prototypes
            </Link>
          </nav>

          <header className="mb-8 max-w-3xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-accent/80">
              Font comparison
            </p>
            <h1 className="text-4xl font-light tracking-[-0.045em] text-foreground sm:text-5xl">
              Organic Glass v2, three voices.
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Identical baseline glass columns isolate typography as the only design variable.
            </p>
          </header>

          <div className="grid flex-1 gap-4 lg:grid-cols-3">
            {fontColumns.map((font) => (
              <FontColumn
                className={font.className}
                key={font.name}
                name={font.name}
                note={font.note}
              />
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}
