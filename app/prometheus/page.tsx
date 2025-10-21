import { ContextLimitBadge } from "@/components/shared/context-limit-badge";

export default function PrometheusPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-4xl font-bold mb-4">Prometheus</h1>
      <p className="text-lg text-muted-foreground">
        This is a basic Prometheus page.
      </p>
      <ContextLimitBadge />
    </main>
  );
}
