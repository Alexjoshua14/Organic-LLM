import { getPlacePhotoUri } from "@/lib/google-places/client";
import type { RestaurantImage } from "@/lib/schemas/gen-ui/restaurant-card";

import type { VenueBundle } from "./types";

/** Hero + up to this many gallery thumbnails (4 Google photo API calls max). */
const GALLERY_MAX = 3;

export type PhotosPatch = {
  heroImage?: RestaurantImage;
  gallery?: RestaurantImage[];
};

async function resolvePhotoUrl(
  userId: string,
  photoName: string | undefined
): Promise<string | undefined> {
  if (!photoName?.trim()) return undefined;

  const result = await getPlacePhotoUri(userId, photoName);

  return result.ok ? result.data : undefined;
}

export async function buildRestaurantPhotos(
  userId: string,
  bundle: VenueBundle,
  venueName: string
): Promise<PhotosPatch> {
  const photos = bundle.photos ?? [];
  const urls: string[] = [];

  for (const photo of photos.slice(0, GALLERY_MAX + 1)) {
    const url = await resolvePhotoUrl(userId, photo.name);

    if (url) urls.push(url);
  }

  if (urls.length === 0) {
    return {};
  }

  const heroUrl = urls[0]!;
  const galleryUrls = urls.slice(1);

  return {
    heroImage: {
      url: heroUrl,
      alt: `${venueName} exterior`,
      kind: "exterior",
    },
    gallery: galleryUrls.slice(0, GALLERY_MAX).map((url, index) => ({
      url,
      alt: `${venueName} photo ${index + 2}`,
      kind: "other" as const,
    })),
  };
}
