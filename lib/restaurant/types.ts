import type { GooglePlaceDetails } from "@/lib/google-places/types";
import type { RestaurantCardBlock } from "@/lib/schemas/gen-ui/restaurant-card";

export type GatherRestaurantInput = {
  name: string;
  city?: string;
  lat?: number;
  lng?: number;
};

export type VenueCandidate = {
  placeId: string;
  name: string;
  address?: string;
};

export type GatherRestaurantAmbiguous = {
  status: "ambiguous";
  candidates: VenueCandidate[];
};

export type GatherRestaurantError = {
  status: "error";
  error: string;
};

export type GatherRestaurantResolved = {
  status: "resolved";
  block: RestaurantCardBlock;
};

export type GatherRestaurantResult =
  | GatherRestaurantAmbiguous
  | GatherRestaurantError
  | GatherRestaurantResolved;

/** Raw Google Place Details payload used by Phase 2 mappers. */
export type VenueBundle = GooglePlaceDetails & {
  placeId: string;
};

export type RestaurantCardPatch = Partial<
  Pick<
    RestaurantCardBlock,
    | "name"
    | "storeType"
    | "summary"
    | "address"
    | "phone"
    | "rating"
    | "heroImage"
    | "gallery"
    | "hours"
    | "menu"
    | "links"
  >
>;
