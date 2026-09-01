import type { GooglePlaceSearchResult } from "@/lib/google-places/types";

import type { VenueCandidate } from "./types";

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function placeDisplayName(place: GooglePlaceSearchResult): string {
  return place.displayName?.text?.trim() ?? "";
}

export function toVenueCandidate(place: GooglePlaceSearchResult): VenueCandidate | null {
  const placeId = place.id?.trim();

  if (!placeId) return null;

  const name = placeDisplayName(place);

  if (!name) return null;

  return {
    placeId,
    name,
    address: place.formattedAddress?.trim() || undefined,
  };
}

export function filterPlacesByCity(
  places: GooglePlaceSearchResult[],
  city: string
): GooglePlaceSearchResult[] {
  const needle = city.trim().toLowerCase();

  if (!needle) return places;

  return places.filter((place) => place.formattedAddress?.toLowerCase().includes(needle));
}

export type SearchResolution =
  | { kind: "resolved"; placeId: string; name: string }
  | { kind: "ambiguous"; candidates: VenueCandidate[] }
  | { kind: "not_found" };

export function resolveSearchResults(
  places: GooglePlaceSearchResult[],
  queryName: string,
  city?: string
): SearchResolution {
  const candidates = places
    .map(toVenueCandidate)
    .filter((c): c is VenueCandidate => c != null);

  if (candidates.length === 0) {
    return { kind: "not_found" };
  }

  let filtered = places;

  if (city?.trim()) {
    filtered = filterPlacesByCity(places, city);
  }

  const filteredCandidates = filtered
    .map(toVenueCandidate)
    .filter((c): c is VenueCandidate => c != null);

  const pool = filteredCandidates.length > 0 ? filteredCandidates : candidates;
  const normalizedQuery = normalizeName(queryName);

  const exactMatches = pool.filter((c) => normalizeName(c.name) === normalizedQuery);

  if (exactMatches.length === 1) {
    return { kind: "resolved", placeId: exactMatches[0]!.placeId, name: exactMatches[0]!.name };
  }

  if (pool.length === 1) {
    return { kind: "resolved", placeId: pool[0]!.placeId, name: pool[0]!.name };
  }

  if (exactMatches.length > 1) {
    return { kind: "ambiguous", candidates: exactMatches.slice(0, 3) };
  }

  const prefixMatches = pool.filter((c) => normalizeName(c.name).startsWith(normalizedQuery));

  if (prefixMatches.length === 1) {
    return {
      kind: "resolved",
      placeId: prefixMatches[0]!.placeId,
      name: prefixMatches[0]!.name,
    };
  }

  return { kind: "ambiguous", candidates: pool.slice(0, 3) };
}

export function buildTextQuery(input: { name: string; city?: string }): string {
  const parts = [input.name.trim()];

  if (input.city?.trim()) {
    parts.push(input.city.trim());
  }

  return parts.join(" ");
}
