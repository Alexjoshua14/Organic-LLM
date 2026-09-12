import type { RestaurantLinks } from "@/lib/schemas/gen-ui/restaurant-card";

import type { VenueBundle } from "./types";

export type AddressPatch = {
  address?: string;
  phone?: string;
  links?: RestaurantLinks;
};

export function buildRestaurantAddress(bundle: VenueBundle): AddressPatch {
  const address = bundle.formattedAddress?.trim();
  const phone = bundle.nationalPhoneNumber?.trim();
  const website = bundle.websiteUri?.trim();
  const googleMaps = bundle.googleMapsUri?.trim();

  const links: RestaurantLinks = {};

  if (website && /^https?:\/\//i.test(website)) {
    links.website = website;
  }

  if (googleMaps && /^https?:\/\//i.test(googleMaps)) {
    links.googleMaps = googleMaps;
  }

  if (address) {
    links.directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }

  return {
    address: address || undefined,
    phone: phone || undefined,
    links: Object.keys(links).length > 0 ? links : undefined,
  };
}
