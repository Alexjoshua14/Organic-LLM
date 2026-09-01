import type {
  DayOfWeek,
  RestaurantHolidayHours,
  RestaurantHours,
  RestaurantHoursDay,
} from "@/lib/schemas/gen-ui/restaurant-card";

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function getTodayDayOfWeek(date = new Date()): DayOfWeek {
  return JS_DAY_TO_ENUM[date.getDay()]!;
}

export function formatTimeOfDay(value: string): string {
  const trimmed = value.trim();

  const twelveHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);

  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minutes = twelveHour[2];
    const period = twelveHour[3].toLowerCase() as "am" | "pm";

    return format12HourDisplay(hour, minutes, period);
  }

  const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})$/);

  if (twentyFour) {
    const hour24 = Number(twentyFour[1]);
    const minutes = twentyFour[2];
    const period = hour24 >= 12 ? "pm" : "am";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

    return format12HourDisplay(hour12, minutes, period);
  }

  return trimmed;
}

function format12HourDisplay(hour: number, minutes: string | undefined, period: "am" | "pm"): string {
  if (!minutes || minutes === "00") {
    return `${hour}${period}`;
  }

  return `${hour}:${minutes} ${period}`;
}

export function formatHoursRange(open: string, close: string): string {
  return `${formatTimeOfDay(open)} – ${formatTimeOfDay(close)}`;
}

/** Formats a single range string such as `10:00 - 22:30`. */
export function formatHoursRangeString(value: string): string {
  const parts = value.split(/\s*[–—-]\s*/);

  if (parts.length === 2 && parts[0] && parts[1]) {
    return formatHoursRange(parts[0], parts[1]);
  }

  return value;
}

export function formatHoursDay(day: RestaurantHoursDay): string {
  if (day.closed) return "Closed";
  if (day.open && day.close) return formatHoursRange(day.open, day.close);

  return day.note ?? "Hours unavailable";
}

export function findHoursForDay(
  schedule: RestaurantHoursDay[] | undefined,
  day: DayOfWeek
): RestaurantHoursDay | undefined {
  return schedule?.find((entry) => entry.day === day);
}

export function findHolidayOverrideForDate(
  overrides: RestaurantHolidayHours[] | undefined,
  date = new Date()
): RestaurantHolidayHours | undefined {
  if (!overrides?.length) return undefined;

  const iso = date.toISOString().slice(0, 10);

  return overrides.find((entry) => entry.date === iso);
}

export function resolveTodayHours(
  hours: RestaurantHours | undefined,
  date = new Date()
): { label: string; detail?: string; isClosed: boolean; isHoliday: boolean } {
  if (!hours) {
    return { label: "Hours unavailable", isClosed: false, isHoliday: false };
  }

  const holiday = findHolidayOverrideForDate(hours.holidayOverrides, date);

  if (holiday) {
    if (holiday.closed) {
      return { label: "Closed today", detail: holiday.label, isClosed: true, isHoliday: true };
    }

    return {
      label: holiday.hours ? formatHoursRangeString(holiday.hours) : "Special hours",
      detail: holiday.label,
      isClosed: false,
      isHoliday: true,
    };
  }

  const today = getTodayDayOfWeek(date);
  const entry = findHoursForDay(hours.regular, today);

  if (!entry) {
    return { label: "Hours unavailable", isClosed: false, isHoliday: false };
  }

  return {
    label: formatHoursDay(entry),
    detail: entry.note,
    isClosed: Boolean(entry.closed),
    isHoliday: false,
  };
}

export function resolveKitchenHoursForDay(
  hours: RestaurantHours | undefined,
  day: DayOfWeek = getTodayDayOfWeek()
): string | null {
  const kitchen = findHoursForDay(hours?.kitchen, day);

  if (!kitchen) return null;

  return formatHoursDay(kitchen);
}

export function sortDaysMondayFirst(days: RestaurantHoursDay[]): RestaurantHoursDay[] {
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

  return [...days].sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day));
}

export function dayLabel(day: DayOfWeek, today: DayOfWeek = getTodayDayOfWeek()): string {
  const base = day.charAt(0).toUpperCase() + day.slice(1);

  return day === today ? `${base} (today)` : base;
}

export function formatReviewCount(count: number): string {
  if (count >= 10_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (count >= 1_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;

  return count.toLocaleString();
}

export function buildDirectionsHref(address: string, links?: { directions?: string }): string {
  if (links?.directions) return links.directions;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function buildTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");

  return `tel:${digits}`;
}

export { DAY_INDEX };
