"use client";

type DangerZoneProps = {
  children: React.ReactNode;
};

export function DangerZone({ children }: DangerZoneProps) {
  return (
    <section
      aria-labelledby="danger-section-heading"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-4"
    >
      <h3 className="text-sm font-medium text-destructive" id="danger-section-heading">
        Danger zone
      </h3>
      {children}
    </section>
  );
}
