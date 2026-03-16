"use client";

import type { ProfileSection, ProfileTree } from "@/lib/schemas/profileTree";

type ProfileTreeViewProps = {
  tree: ProfileTree;
  isPlaceholder?: boolean;
};

/* ── style categorisation ───────────────────────────────────────── */

type SectionStyle = "open" | "card";

/**
 * Prose-only sections render "open" — no card, editorial flow.
 * Sections with items (no body) or children render as "card".
 * Sections with body + items render "open" (body bare, items as loose pills).
 */
function styleFor(section: ProfileSection): SectionStyle {
  if (section.children?.length) return "card";
  if (section.body && !section.items?.length) return "open";
  if (section.body && section.items?.length) return "open";

  return "card";
}

/* ── layout ─────────────────────────────────────────────────────── */

type LayoutRow =
  | { kind: "open"; section: ProfileSection }
  | { kind: "cards"; sections: ProfileSection[] };

/**
 * Build layout rows: open sections always get their own row.
 * Card sections pair up side-by-side when possible.
 */
function buildLayout(sections: ProfileSection[]): LayoutRow[] {
  const rows: LayoutRow[] = [];
  let pendingCard: ProfileSection | null = null;

  const flushPending = () => {
    if (pendingCard) {
      rows.push({ kind: "cards", sections: [pendingCard] });
      pendingCard = null;
    }
  };

  for (const section of sections) {
    const style = styleFor(section);

    if (style === "open") {
      flushPending();
      rows.push({ kind: "open", section });
    } else {
      // Card — full-width if it has children, otherwise half (pair-able)
      const needsFull = Boolean(section.children?.length);

      if (needsFull) {
        flushPending();
        rows.push({ kind: "cards", sections: [section] });
      } else if (pendingCard) {
        rows.push({ kind: "cards", sections: [pendingCard, section] });
        pendingCard = null;
      } else {
        pendingCard = section;
      }
    }
  }
  flushPending();

  return rows;
}

/* ── visual palette ─────────────────────────────────────────────── */

const CARD_FILLS = [
  "bg-[#f0eeeb] dark:bg-[#1c1b19]/60",
  "bg-[#eceef1] dark:bg-[#191b1e]/60",
  "bg-[#ecf0ec] dark:bg-[#181c18]/55",
  "bg-[#f0ecec] dark:bg-[#1c1919]/50",
  "bg-[#edeced] dark:bg-[#1a191c]/50",
  "bg-[#efeeeb] dark:bg-[#1b1a18]/55",
];

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`;

function NoiseOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl mix-blend-overlay opacity-60 dark:opacity-40"
      style={{ backgroundImage: NOISE_SVG, backgroundRepeat: "repeat" }}
    />
  );
}

/* ── open section (no background, editorial) ────────────────────── */

function OpenSection({
  section,
  isPlaceholder,
}: {
  section: ProfileSection;
  isPlaceholder?: boolean;
}) {
  const hasBody = Boolean(section.body?.trim());
  const hasItems = Boolean(section.items?.length);

  return (
    <section aria-labelledby={section.id} className="px-1">
      <h2
        className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
          isPlaceholder ? "text-muted-foreground/40" : "text-muted-foreground/50"
        }`}
        id={section.id}
      >
        {section.title}
      </h2>

      {hasBody && (
        <p
          className={`max-w-[58ch] text-[15px] leading-[1.75] md:text-base md:leading-[1.8] ${
            isPlaceholder ? "text-muted-foreground italic" : "text-foreground/75"
          }`}
        >
          {section.body}
        </p>
      )}

      {hasItems && (
        <div className={`flex flex-wrap gap-2 ${hasBody ? "mt-5" : ""}`}>
          {section.items!.map((item, i) => (
            <span
              key={`${section.id}-${i}`}
              className={`
                rounded-full px-3 py-1 text-xs font-medium
                ${
                  isPlaceholder
                    ? "bg-muted/30 text-muted-foreground/50"
                    : "bg-muted/50 text-foreground/60 dark:bg-muted/30"
                }
              `}
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── card section (solid fill + noise) ──────────────────────────── */

function CardSection({
  section,
  isPlaceholder,
  colorIndex = 0,
  isFull,
}: {
  section: ProfileSection;
  isPlaceholder?: boolean;
  colorIndex?: number;
  isFull: boolean;
}) {
  const fill = CARD_FILLS[colorIndex % CARD_FILLS.length];
  const hasBody = Boolean(section.body?.trim());
  const hasItems = Boolean(section.items?.length);
  const hasChildren = Boolean(section.children?.length);

  if (isPlaceholder) {
    return (
      <section
        aria-labelledby={section.id}
        className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-6 md:px-8 md:py-8"
      >
        <h2
          className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60"
          id={section.id}
        >
          {section.title}
        </h2>
        {hasBody && (
          <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground italic">
            {section.body}
          </p>
        )}
        {hasItems && (
          <div className="mt-4 flex flex-wrap gap-2">
            {section.items!.map((item, i) => (
              <span
                key={`${section.id}-${i}`}
                className="rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={section.id}
      className={`
        group relative overflow-hidden rounded-2xl
        border border-border/40
        ${fill}
        px-6 py-6 md:px-8 md:py-8
        transition-shadow duration-300
        hover:shadow-md hover:shadow-black/3
        dark:border-border/30
        dark:hover:shadow-black/20
      `}
    >
      <NoiseOverlay />

      <h2
        className="relative mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70"
        id={section.id}
      >
        {section.title}
      </h2>

      {hasBody && (
        <p className="relative max-w-[60ch] text-sm leading-[1.7] text-foreground/85 md:text-[15px]">
          {section.body}
        </p>
      )}

      {hasItems && (
        <div className={`relative flex flex-wrap gap-2 ${hasBody ? "mt-5" : ""}`}>
          {section.items!.map((item, i) => (
            <span
              key={`${section.id}-${i}`}
              className="
                rounded-full
                bg-white/50 dark:bg-white/7
                border border-black/4 dark:border-white/6
                px-3 py-1 text-xs font-medium text-foreground/75
                transition-colors duration-200
                hover:bg-white/80 hover:text-foreground
                dark:hover:bg-white/10
              "
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {hasChildren && (
        <div
          className={`relative grid gap-5 ${hasBody ? "mt-6" : ""} ${
            isFull && section.children!.length >= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {section.children!.map((child) => (
            <div
              key={child.id}
              className="
                rounded-xl
                bg-white/40 dark:bg-white/4
                border border-black/3 dark:border-white/5
                px-5 py-5
              "
            >
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {child.title}
              </h3>
              {child.body && (
                <p className="text-sm leading-relaxed text-foreground/75">{child.body}</p>
              )}
              {child.items?.length ? (
                <div className="flex flex-wrap gap-2">
                  {child.items.map((item, i) => (
                    <span
                      key={`${child.id}-${i}`}
                      className="
                        rounded-full
                        bg-white/50 dark:bg-white/5
                        border border-black/3 dark:border-white/4
                        px-3 py-1
                        text-[11px] font-medium text-foreground/65
                      "
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── main grid ──────────────────────────────────────────────────── */

export function ProfileTreeView({ tree, isPlaceholder }: ProfileTreeViewProps) {
  const layout = buildLayout(tree.sections);
  let cardColorIdx = 0;

  return (
    <div className="flex flex-col gap-8">
      {layout.map((row, rowIdx) => {
        if (row.kind === "open") {
          return (
            <OpenSection key={row.section.id} isPlaceholder={isPlaceholder} section={row.section} />
          );
        }

        // Card row — single or paired
        if (row.sections.length === 1) {
          const idx = cardColorIdx++;

          return (
            <CardSection
              key={row.sections[0].id}
              isFull
              colorIndex={idx}
              isPlaceholder={isPlaceholder}
              section={row.sections[0]}
            />
          );
        }

        return (
          <div key={`row-${rowIdx}`} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {row.sections.map((section) => {
              const idx = cardColorIdx++;

              return (
                <CardSection
                  key={section.id}
                  colorIndex={idx}
                  isFull={false}
                  isPlaceholder={isPlaceholder}
                  section={section}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
