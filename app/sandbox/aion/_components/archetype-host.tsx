"use client";

export function ArchetypeHost() {
  return (
    <aside
      className={[
        "min-w-72",
        "max-w-lg",
        "h-full",
        "border-l",
        "border-border",
        "bg-background/70",
        "backdrop-blur-md",
        "px-4",
        "pt-14",
        "pb-6",
        "flex",
        "flex-col",
        "gap-3",
      ].join(" ")}
    >
      <div className="text-xs uppercase tracking-wide text-foreground/60">
        Archetype (coming soon)
      </div>
      <div className="rounded-lg border border-border/70 bg-background-secondary/70 p-3 text-sm text-foreground/80">
        This area will host the Archetype experience. Sample placeholder text for
        now.
      </div>
    </aside>
  );
}

