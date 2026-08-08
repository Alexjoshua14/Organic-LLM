import type {
  DayOfWeek,
  RestaurantHours,
  RestaurantHoursDay,
} from "@/lib/schemas/gen-ui/restaurant-card";
import type { GoogleOpeningHours, GoogleOpeningHoursPeriod } from "@/lib/google-places/types";

import type { VenueBundle } from "./types";

const DAY_ORDER: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** Google Places (New) uses 0=Sunday … 6=Saturday in period day fields. */
const GOOGLE_DAY_INDEX_TO_ENUM: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function googleDayToEnum(day: number | undefined): DayOfWeek | undefined {
  if (day == null || day < 0 || day > 6) return undefined;

  return GOOGLE_DAY_INDEX_TO_ENUM[day];
}

function formatTimePoint(hour?: number, minute?: number): string | undefined {
  if (hour == null) return undefined;

  const h = hour % 24;
  const m = minute ?? 0;
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;

  if (m === 0) {
    return `${hour12}${period}`;
  }

  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function periodToDayEntry(period: GoogleOpeningHoursPeriod): RestaurantHoursDay | null {
  const day = googleDayToEnum(period.open?.day);

  if (!day) return null;

  const open = formatTimePoint(period.open?.hour, period.open?.minute);
  const close = formatTimePoint(period.close?.hour, period.close?.minute);

  if (!open || !close) {
    return { day, closed: true };
  }

  return { day, open, close };
}

function mapOpeningHours(hours: GoogleOpeningHours | undefined): RestaurantHoursDay[] {
  if (!hours?.periods?.length) return [];

  const byDay = new Map<DayOfWeek, RestaurantHoursDay>();

  for (const period of hours.periods) {
    const entry = periodToDayEntry(period);

    if (entry) {
      byDay.set(entry.day, entry);
    }
  }

  return DAY_ORDER.filter((day) => byDay.has(day)).map((day) => byDay.get(day)!);
}

function findKitchenHours(bundle: VenueBundle): GoogleOpeningHours | undefined {
  const secondary = bundle.regularSecondaryOpeningHours ?? [];

  return secondary.find((h) => h.secondaryHoursType === "KITCHEN") ?? secondary[0];
}

export function buildRestaurantHours(bundle: VenueBundle): RestaurantHours | undefined {
  const regular = mapOpeningHours(bundle.regularOpeningHours);

  if (regular.length === 0) {
    return undefined;
  }

  const kitchen = mapOpeningHours(findKitchenHours(bundle));
  const timezone = bundle.timeZone?.id?.trim();

  return {
    regular,
    kitchen: kitchen.length > 0 ? kitchen : undefined,
    timezone: timezone || undefined,
  };
}
