export const formatNumber = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);

export const formatDuration = (value: number | null) =>
  value === null ? "—" : `${formatNumber(value)} ms`;

export const formatSeconds = (milliseconds: number | null) =>
  milliseconds === null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(milliseconds / 1_000);

export const formatUsd = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      }).format(value);

export const formatRate = (part: number, total: number) =>
  total ? `${formatNumber((part / total) * 100)}%` : "—";
