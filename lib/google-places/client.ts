import "server-only";

import { createLogger } from "@/lib/logger";
import { checkGooglePlacesLimit } from "@/lib/rate-limit/google-places";

import type {
  GooglePhotoMediaResponse,
  GooglePlaceDetails,
  GoogleTextSearchResponse,
} from "./types";

const logger = createLogger("lib/google-places/client.ts");

const PLACES_BASE = "https://places.googleapis.com/v1";

const SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location";

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "timeZone",
  "regularOpeningHours",
  "regularSecondaryOpeningHours",
  "rating",
  "userRatingCount",
  "photos",
  "businessStatus",
  "primaryType",
  "primaryTypeDisplayName",
  "editorialSummary",
].join(",");

export type GooglePlacesClientError =
  | { code: "missing_api_key" }
  | { code: "rate_limited"; message: string }
  | { code: "http_error"; status: number; message: string }
  | { code: "network_error"; message: string };

export type GooglePlacesResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: GooglePlacesClientError };

function getApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() ?? null;
}

async function placesFetch<T>(
  userId: string,
  path: string,
  init: RequestInit & { fieldMask?: string }
): Promise<GooglePlacesResult<T>> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return { ok: false, error: { code: "missing_api_key" } };
  }

  const limit = await checkGooglePlacesLimit(userId);

  if (!limit.success) {
    return {
      ok: false,
      error: { code: "rate_limited", message: limit.error ?? "Rate limited" },
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    ...(init.fieldMask ? { "X-Goog-FieldMask": init.fieldMask } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const { fieldMask: _fm, ...fetchInit } = init;

  try {
    const res = await fetch(`${PLACES_BASE}${path}`, { ...fetchInit, headers });

    if (!res.ok) {
      const body = await res.text().catch(() => "");

      logger.error("placesFetch", `HTTP ${res.status} ${path}`, { body: body.slice(0, 200) });

      return {
        ok: false,
        error: {
          code: "http_error",
          status: res.status,
          message: body.slice(0, 200) || res.statusText,
        },
      };
    }

    const data = (await res.json()) as T;

    return { ok: true, data };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));

    logger.error("placesFetch", `Network error ${path}: ${e.message}`);

    return { ok: false, error: { code: "network_error", message: e.message } };
  }
}

export type TextSearchInput = {
  textQuery: string;
  maxResultCount?: number;
  locationBias?: { latitude: number; longitude: number; radiusMeters?: number };
};

export async function textSearchPlaces(
  userId: string,
  input: TextSearchInput
): Promise<GooglePlacesResult<GoogleTextSearchResponse>> {
  const body: Record<string, unknown> = {
    textQuery: input.textQuery,
    maxResultCount: input.maxResultCount ?? 5,
  };

  if (input.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: input.locationBias.latitude,
          longitude: input.locationBias.longitude,
        },
        radius: input.locationBias.radiusMeters ?? 50_000,
      },
    };
  }

  return placesFetch<GoogleTextSearchResponse>(userId, "/places:searchText", {
    method: "POST",
    body: JSON.stringify(body),
    fieldMask: SEARCH_FIELD_MASK,
  });
}

export async function getPlaceDetails(
  userId: string,
  placeId: string
): Promise<GooglePlacesResult<GooglePlaceDetails>> {
  const id = placeId.startsWith("places/") ? placeId.slice("places/".length) : placeId;

  return placesFetch<GooglePlaceDetails>(userId, `/places/${encodeURIComponent(id)}`, {
    method: "GET",
    fieldMask: DETAILS_FIELD_MASK,
  });
}

export async function getPlacePhotoUri(
  userId: string,
  photoName: string,
  maxPx = 1200
): Promise<GooglePlacesResult<string>> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return { ok: false, error: { code: "missing_api_key" } };
  }

  const limit = await checkGooglePlacesLimit(userId);

  if (!limit.success) {
    return {
      ok: false,
      error: { code: "rate_limited", message: limit.error ?? "Rate limited" },
    };
  }

  const path = photoName.startsWith("/") ? photoName : `/${photoName}`;
  const url = `${PLACES_BASE}${path}/media?maxHeightPx=${maxPx}&maxWidthPx=${maxPx}&skipHttpRedirect=true`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-Goog-Api-Key": apiKey },
    });

    if (!res.ok) {
      return {
        ok: false,
        error: {
          code: "http_error",
          status: res.status,
          message: res.statusText,
        },
      };
    }

    const data = (await res.json()) as GooglePhotoMediaResponse;

    if (!data.photoUri) {
      return {
        ok: false,
        error: { code: "http_error", status: res.status, message: "No photoUri in response" },
      };
    }

    return { ok: true, data: data.photoUri };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));

    return { ok: false, error: { code: "network_error", message: e.message } };
  }
}

export function googlePlacesErrorMessage(error: GooglePlacesClientError): string {
  switch (error.code) {
    case "missing_api_key":
      return "Google Places API is not configured";
    case "rate_limited":
      return error.message;
    case "http_error":
      return `Google Places request failed (${error.status})`;
    case "network_error":
      return "Could not reach Google Places";
  }
}
