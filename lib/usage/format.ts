export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;

  return value.toLocaleString();
}

export function formatUsd(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value > 0 && value < 0.01) return "<$0.01";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  if (value >= 999) return "999%+";
  if (value >= 100) return `${Math.round(value)}%`;
  if (value >= 10) return `${Math.round(value)}%`;

  return `${value.toFixed(1)}%`;
}

export function formatModelRate(inputPerMillion: number, outputPerMillion: number): string {
  return `$${inputPerMillion.toFixed(2)} / $${outputPerMillion.toFixed(2)} per 1M in/out`;
}

export function shortModelLabel(modelId: string): string {
  const slash = modelId.lastIndexOf("/");

  if (slash === -1) return modelId;

  const provider = modelId.slice(0, slash);
  const name = modelId.slice(slash + 1);

  return `${provider}/${name.replace(/-/g, " ")}`;
}
