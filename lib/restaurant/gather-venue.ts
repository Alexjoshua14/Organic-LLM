import {
  getPlaceDetails,
  googlePlacesErrorMessage,
  textSearchPlaces,
} from "@/lib/google-places/client";

import { buildTextQuery, resolveSearchResults } from "./search-venue";
import type { GatherRestaurantInput, VenueBundle } from "./types";

export type SearchVenueResult =
  | { ok: true; bundle: VenueBundle }
  | { ok: false; kind: "ambiguous"; candidates: { placeId: string; name: string; address?: string }[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "error"; error: string };

export async function searchAndGatherVenue(
  userId: string,
  input: GatherRestaurantInput
): Promise<SearchVenueResult> {
  const textQuery = buildTextQuery(input);

  const searchResult = await textSearchPlaces(userId, {
    textQuery,
    maxResultCount: 5,
    locationBias:
      input.lat != null && input.lng != null
        ? { latitude: input.lat, longitude: input.lng }
        : undefined,
  });

  if (!searchResult.ok) {
    return { ok: false, kind: "error", error: googlePlacesErrorMessage(searchResult.error) };
  }

  const resolution = resolveSearchResults(
    searchResult.data.places ?? [],
    input.name,
    input.city
  );

  if (resolution.kind === "not_found") {
    return { ok: false, kind: "not_found" };
  }

  if (resolution.kind === "ambiguous") {
    return { ok: false, kind: "ambiguous", candidates: resolution.candidates };
  }

  const detailsResult = await getPlaceDetails(userId, resolution.placeId);

  if (!detailsResult.ok) {
    return { ok: false, kind: "error", error: googlePlacesErrorMessage(detailsResult.error) };
  }

  return {
    ok: true,
    bundle: {
      ...detailsResult.data,
      placeId: resolution.placeId,
    },
  };
}
