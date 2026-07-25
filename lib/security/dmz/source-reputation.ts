import type { DmzConnectionProvider, DmzSourceReputation } from "./types";
import {
  DMZ_BLACKLIST_FLAG_RATIO,
  DMZ_BLACKLIST_MIN_INTAKES,
} from "./types";

/** Per-user source reputation — v1 in-memory; migrate to durable store when connections ship. */
const reputationByUser = new Map<string, Map<DmzConnectionProvider, DmzSourceReputation>>();

function userKey(userId: string): string {
  return userId;
}

function getUserMap(userId: string): Map<DmzConnectionProvider, DmzSourceReputation> {
  const key = userKey(userId);
  let map = reputationByUser.get(key);

  if (!map) {
    map = new Map();
    reputationByUser.set(key, map);
  }

  return map;
}

function defaultReputation(provider: DmzConnectionProvider): DmzSourceReputation {
  return {
    provider,
    totalIntakes: 0,
    flaggedIntakes: 0,
    blockedIntakes: 0,
    blacklisted: false,
  };
}

export function getSourceReputation(
  userId: string,
  provider: DmzConnectionProvider
): DmzSourceReputation {
  const map = getUserMap(userId);

  return map.get(provider) ?? defaultReputation(provider);
}

export function listSourceReputations(userId: string): DmzSourceReputation[] {
  return Array.from(getUserMap(userId).values());
}

export function recordIntakeOutcome(args: {
  userId: string;
  provider: DmzConnectionProvider;
  flagged: boolean;
  blocked: boolean;
}): DmzSourceReputation {
  const map = getUserMap(args.userId);
  const current = map.get(args.provider) ?? defaultReputation(args.provider);

  const next: DmzSourceReputation = {
    ...current,
    totalIntakes: current.totalIntakes + 1,
    flaggedIntakes: current.flaggedIntakes + (args.flagged ? 1 : 0),
    blockedIntakes: current.blockedIntakes + (args.blocked ? 1 : 0),
    lastFlagAt: args.flagged || args.blocked ? Date.now() : current.lastFlagAt,
  };

  const flagRatio =
    next.totalIntakes > 0 ? (next.flaggedIntakes + next.blockedIntakes) / next.totalIntakes : 0;

  if (
    !next.blacklisted &&
    next.totalIntakes >= DMZ_BLACKLIST_MIN_INTAKES &&
    flagRatio >= DMZ_BLACKLIST_FLAG_RATIO
  ) {
    next.blacklisted = true;
    next.blacklistedAt = Date.now();
  }

  map.set(args.provider, next);

  return next;
}

export function isProviderBlacklisted(
  userId: string,
  provider: DmzConnectionProvider
): boolean {
  return getSourceReputation(userId, provider).blacklisted;
}

/** Test helper — clears in-memory reputation state. */
export function resetSourceReputationForTests(): void {
  reputationByUser.clear();
}
