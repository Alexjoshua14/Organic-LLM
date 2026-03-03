"use client";

type DangerZoneProps = {
  children: React.ReactNode;
};

export function DangerZone({ children }: DangerZoneProps) {
  return (
    <section
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-4"
      aria-labelledby="danger-section-heading"
    >
      <h3
        id="danger-section-heading"
        className="text-sm font-medium text-destructive"
      >
        Danger zone
      </h3>
      {children}
    </section>
  );
}
