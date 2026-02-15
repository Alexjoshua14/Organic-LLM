"use client";

/**
 * Identity roles as premium, engraved-feeling badges.
 * Built for hardware that can handle subtle shadows and backdrop-blur.
 */
export function RoleBadges({ roles }: { roles: string[] }) {
  if (!roles?.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-3" role="list">
      {roles.map((role) => (
        <span
          key={role}
          role="listitem"
          className="
            inline-flex items-center rounded-lg border border-border/80
            bg-linear-to-b from-muted/80 to-muted
            px-4 py-2
            text-sm font-semibold tracking-wide text-foreground
            shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_1px_2px_0_rgba(0,0,0,0.04)]
            transition-shadow duration-200
            dark:from-muted/60 dark:to-muted/80
            dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_1px_2px_0_rgba(0,0,0,0.2)]
          "
          style={{
            textShadow:
              "0 1px 0 rgba(255,255,255,.35), 0 -0.5px 0 rgba(0,0,0,.08)",
          }}
        >
          {role}
        </span>
      ))}
    </div>
  );
}
