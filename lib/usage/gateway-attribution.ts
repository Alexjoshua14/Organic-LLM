/**
 * AI Gateway request attribution, so the Gateway spend report can group real billed cost by
 * user and by operation (`groupBy: "user" | "tag"`). Spread into `providerOptions.gateway`.
 */
export function gatewayAttribution(args: { userId: string; operation: string }): {
  user: string;
  tags: string[];
} {
  return { user: args.userId, tags: [`op:${args.operation}`] };
}

/**
 * Billed USD for one Gateway call when the response carries it (`providerMetadata.gateway.cost`).
 * Preferred over the local price table: it is what the Gateway actually charged, including
 * models the table does not list. Undefined when absent or unparseable.
 */
export function readGatewayBilledCostUsd(providerMetadata: unknown): number | undefined {
  if (!providerMetadata || typeof providerMetadata !== "object") return undefined;

  const gateway = (providerMetadata as Record<string, unknown>).gateway;

  if (!gateway || typeof gateway !== "object") return undefined;

  const raw = (gateway as Record<string, unknown>).cost;
  const value = typeof raw === "string" ? raw.trim() === "" ? Number.NaN : Number(raw) : raw;

  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
