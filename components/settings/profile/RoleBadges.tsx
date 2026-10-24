"use client";

/**
 * Identity roles as premium, engraved-feeling badges.
 * Left-aligned for horizontal hero layout.
 */
export function RoleBadges({ roles }: { roles: string[] }) {
  if (!roles?.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:justify-start" role="list">
      {roles.map((role) => (
        <span
          key={role}
          className="
            inline-flex items-center rounded-lg border border-border/60
            bg-linear-to-b from-muted/70 to-muted/90
            px-3 py-1.5
            text-xs font-semibold tracking-wide text-foreground/80
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_1px_2px_0_rgba(0,0,0,0.04)]
            transition-all duration-200
            hover:border-border hover:text-foreground
            dark:from-muted/50 dark:to-muted/70
            dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_1px_3px_0_rgba(0,0,0,0.25)]
          "
          role="listitem"
        >
          {role}
        </span>
      ))}
    </div>
  );
}
