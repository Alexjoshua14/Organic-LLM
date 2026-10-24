/**
 * Date/time presentation helpers for UI copy.
 */

/**
 * Formats a date string to a human-readable format like "December 5th, 2025" (English ordinals).
 * Does not use today/yesterday; for that, see {@link formatRecentCalendarDate}.
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  // Get ordinal suffix (st, nd, rd, th)
  const getOrdinalSuffix = (n: number): string => {
    if (n > 3 && n < 21) return "th";
    switch (n % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
}

/**
 * Calendar-relative labels for activity / "updated" lines: `today at …`, `yesterday at …`,
 * or a long locale date (no time) for older instants.
 *
 * For a fixed English long date with ordinals, use {@link formatDate} instead — it does not
 * handle today/yesterday.
 */
export function sameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export type FormatRecentCalendarDateOptions = {
  /** Anchor "now" for tests; defaults to `new Date()`. */
  now?: Date;
  /** BCP 47 locale for time/date strings; defaults to runtime default. */
  locale?: Intl.UnicodeBCP47LocaleIdentifier;
};

export function formatRecentCalendarDate(
  iso: string,
  options?: FormatRecentCalendarDateOptions
): string {
  const now = options?.now ?? new Date();
  const locale = options?.locale;
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  if (sameLocalCalendarDay(d, now)) {
    return `today at ${time}`;
  }

  const yesterday = new Date(now);

  yesterday.setDate(yesterday.getDate() - 1);
  if (sameLocalCalendarDay(d, yesterday)) {
    return `yesterday at ${time}`;
  }

  return d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
}
