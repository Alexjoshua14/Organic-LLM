/** Parse YYYY-MM-DD as UTC calendar date (no local TZ shift). */
export function utcDateFromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

export function isoFromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True when `iso` is a Monday. */
export function isMonday(iso: string): boolean {
  return utcDateFromIso(iso).getUTCDay() === 1;
}

/** Monday of the week containing `iso` (ISO week: Mon–Sun). */
export function mondayOf(iso: string): string {
  const date = utcDateFromIso(iso);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;

  date.setUTCDate(date.getUTCDate() + offset);

  return isoFromUtcDate(date);
}

/** Seven ISO dates Mon–Sun for a Monday `weekStart`. */
export function weekDates(weekStart: string): string[] {
  const monday = utcDateFromIso(weekStart);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);

    d.setUTCDate(monday.getUTCDate() + i);

    return isoFromUtcDate(d);
  });
}

export function dateIsInWeek(iso: string, weekStart: string): boolean {
  const dates = weekDates(weekStart);

  return dates.includes(iso);
}

export function addDaysIso(iso: string, days: number): string {
  const date = utcDateFromIso(iso);

  date.setUTCDate(date.getUTCDate() + days);

  return isoFromUtcDate(date);
}

/** Shift a Monday `weekStart` by whole weeks (negative = previous). */
export function shiftWeek(weekStart: string, deltaWeeks: number): string {
  return mondayOf(addDaysIso(weekStart, deltaWeeks * 7));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Monday for `?week=YYYY-MM-DD`. Invalid or missing params fall back to the
 * Monday of `todayIso` (pass the user's local calendar date).
 */
export function resolveWeekStart(weekParam: string | null | undefined, todayIso: string): string {
  if (weekParam && ISO_DATE.test(weekParam)) {
    return mondayOf(weekParam);
  }

  return mondayOf(todayIso);
}

/** Local calendar YYYY-MM-DD (not UTC), for "this week" in the user's timezone. */
export function localCalendarIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

/** e.g. `Aug 10–16, 2026` (UTC calendar dates). */
export function formatWeekRange(weekStart: string): string {
  const dates = weekDates(weekStart);
  const start = utcDateFromIso(dates[0]!);
  const end = utcDateFromIso(dates[6]!);
  const startMonth = start.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = end.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getUTCDate()}–${end.getUTCDate()}, ${year}`;
  }

  return `${startMonth} ${start.getUTCDate()} – ${endMonth} ${end.getUTCDate()}, ${year}`;
}
