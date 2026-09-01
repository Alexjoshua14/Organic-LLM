/** Minimal shapes for Google Places API (New) responses used by Organic LLM. */

export type GoogleLocalizedText = {
  text?: string;
  languageCode?: string;
};

export type GoogleLatLng = {
  latitude?: number;
  longitude?: number;
};

export type GoogleTimePoint = {
  day?: number;
  hour?: number;
  minute?: number;
  date?: { year?: number; month?: number; day?: number };
};

export type GoogleOpeningHoursPeriod = {
  open?: GoogleTimePoint;
  close?: GoogleTimePoint;
};

export type GoogleOpeningHours = {
  openNow?: boolean;
  periods?: GoogleOpeningHoursPeriod[];
  weekdayDescriptions?: string[];
  secondaryHoursType?: string;
};

export type GooglePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: { displayName?: string; uri?: string }[];
};

export type GooglePlaceSearchResult = {
  id?: string;
  displayName?: GoogleLocalizedText;
  formattedAddress?: string;
  location?: GoogleLatLng;
};

export type GooglePlaceDetails = {
  id?: string;
  displayName?: GoogleLocalizedText;
  formattedAddress?: string;
  location?: GoogleLatLng;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  timeZone?: { id?: string };
  regularOpeningHours?: GoogleOpeningHours;
  regularSecondaryOpeningHours?: GoogleOpeningHours[];
  currentOpeningHours?: GoogleOpeningHours;
  rating?: number;
  userRatingCount?: number;
  photos?: GooglePhoto[];
  businessStatus?: string;
  primaryType?: string;
  primaryTypeDisplayName?: GoogleLocalizedText;
  editorialSummary?: GoogleLocalizedText;
};

export type GoogleTextSearchResponse = {
  places?: GooglePlaceSearchResult[];
};

export type GooglePhotoMediaResponse = {
  photoUri?: string;
};
