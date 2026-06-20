import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";

import {
  assertSafePublicHttpsUrl,
  isBlockedHostAddress,
  isBlockedIPv4,
  isBlockedIPv6,
  isIpLiteralHost,
  type SafeUrlResult,
} from "./safe-url";

export type DnsLookupFn = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>;

const defaultDnsLookup: DnsLookupFn = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });

  return records.map((r) => ({ address: r.address, family: r.family }));
};

export type ResolveHostResult = { ok: true } | { ok: false; reason: string };

/**
 * Resolve hostname and reject if any A/AAAA record maps to a blocked address.
 * Server-only — uses node:dns.
 */
export async function resolveAndAssertSafeHost(
  hostname: string,
  lookup: DnsLookupFn = defaultDnsLookup
): Promise<ResolveHostResult> {
  const host = hostname.toLowerCase();

  if (isBlockedHostAddress(host)) {
    return { ok: false, reason: "Host is not allowed" };
  }

  if (isIpLiteralHost(host)) {
    return { ok: true };
  }

  try {
    const records = await lookup(host);

    if (records.length === 0) {
      return { ok: false, reason: "Host could not be resolved" };
    }

    for (const record of records) {
      const addr = record.address.toLowerCase();

      if (isBlockedIPv4(addr) || isBlockedIPv6(addr) || isBlockedHostAddress(addr)) {
        return { ok: false, reason: "Resolved address is not allowed" };
      }
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "Host could not be resolved" };
  }
}

/**
 * Sync URL parse + async DNS validation before origin fetch.
 */
export async function assertSafePublicHttpsUrlResolved(
  raw: string,
  lookup: DnsLookupFn = defaultDnsLookup
): Promise<SafeUrlResult> {
  const parsed = assertSafePublicHttpsUrl(raw);

  if (!parsed.ok) return parsed;

  const resolved = await resolveAndAssertSafeHost(parsed.hostname, lookup);

  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason };
  }

  return parsed;
}
