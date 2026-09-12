import type { GooglePlaceSearchResult } from "@/lib/google-places/types";

import type { FetchReply } from "./mock-fetch";
import { MOCK_PLACE_SEARCH_RESULT, MOCK_VENUE_BUNDLE } from "./restaurant-fixtures";
import { MOCK_RESTAURANT_MENU_HTML } from "./restaurant-menu-html";

export function googlePlacesSearchReply(
  places: GooglePlaceSearchResult[] = [MOCK_PLACE_SEARCH_RESULT]
): FetchReply {
  return { body: { places } };
}

export function googlePlacesDetailsReply(
  details: Record<string, unknown> = MOCK_VENUE_BUNDLE
): FetchReply {
  return { body: details };
}

export function googlePlacesPhotoReply(photoUri: string): FetchReply {
  return { body: { photoUri } };
}

/** Queued fetch replies for search → details → N photo media calls. */
export function googlePlacesGatherFetchQueue(photoCount = 4): FetchReply[] {
  return [
    googlePlacesSearchReply(),
    googlePlacesDetailsReply(),
    ...Array.from({ length: photoCount }, (_, index) =>
      googlePlacesPhotoReply(`https://example.com/photo-${index + 1}.jpg`)
    ),
  ];
}

const PLACES_HOST = "places.googleapis.com";

/**
 * Routes Google Places + restaurant website fetches safely when they run in parallel
 * (e.g. gatherRestaurant loads photos and menu concurrently).
 */
export function createGooglePlacesAndMenuFetchMock(photoCount = 4) {
  const placesQueue = googlePlacesGatherFetchQueue(photoCount);
  let placesIndex = 0;

  return {
    placesQueue,
    menuReply: { bodyText: MOCK_RESTAURANT_MENU_HTML } satisfies FetchReply,
    route(url: string): FetchReply | undefined {
      if (url.includes(PLACES_HOST)) {
        const reply = placesQueue[placesIndex];

        if (!reply) {
          return undefined;
        }

        placesIndex += 1;

        return reply;
      }

      if (url.startsWith(MOCK_VENUE_BUNDLE.websiteUri!)) {
        return { bodyText: MOCK_RESTAURANT_MENU_HTML };
      }

      return undefined;
    },
  };
}
