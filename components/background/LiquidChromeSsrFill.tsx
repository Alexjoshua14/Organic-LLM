/** Server-rendered fixed gradient — present in initial HTML before client hydration. */
export function LiquidChromeSsrFill({ id }: { id?: string }) {
  return (
    <div
      aria-hidden
      className="liquid-chrome-page-fill pointer-events-none fixed inset-0 z-0"
      id={id}
    />
  );
}
