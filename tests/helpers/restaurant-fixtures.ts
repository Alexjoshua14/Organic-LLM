import type { GooglePlaceSearchResult } from "@/lib/google-places/types";
import type { VenueBundle } from "@/lib/restaurant/types";

export const MOCK_PLACE_SEARCH_RESULT: GooglePlaceSearchResult = {
  id: "places/state-bird-sf",
  displayName: { text: "State Bird Provisions" },
  formattedAddress: "1529 Fillmore St, San Francisco, CA 94115",
};

export const MOCK_VENUE_BUNDLE: VenueBundle = {
  placeId: "state-bird-sf",
  displayName: { text: "State Bird Provisions" },
  formattedAddress: "1529 Fillmore St, San Francisco, CA 94115",
  nationalPhoneNumber: "(415) 795-0230",
  websiteUri: "https://statebirdsf.com",
  googleMapsUri: "https://maps.google.com/?cid=123",
  timeZone: { id: "America/Los_Angeles" },
  rating: 4.6,
  userRatingCount: 1520,
  primaryType: "fine_dining_restaurant",
  editorialSummary: { text: "Award-winning Californian small plates." },
  photos: [
    { name: "places/state-bird-sf/photos/hero" },
    { name: "places/state-bird-sf/photos/g1" },
    { name: "places/state-bird-sf/photos/g2" },
    { name: "places/state-bird-sf/photos/g3" },
    { name: "places/state-bird-sf/photos/g4" },
  ],
  regularOpeningHours: {
    periods: [
      {
        open: { day: 2, hour: 17, minute: 30 },
        close: { day: 2, hour: 22, minute: 0 },
      },
    ],
  },
};
