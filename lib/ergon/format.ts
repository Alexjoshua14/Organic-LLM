/** Format est_minutes for compact row glyphs. */
export function formatEstMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "";

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours}h` : `${hours}h${remainder}m`;
}

/** Format summed capacity for plan group headers. */
export function formatCapacityMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function formatPlannedDate(
  plannedAt: string | null,
  plannedHasTime: boolean,
  now = new Date()
): string {
  if (!plannedAt) return "";

  const date = new Date(plannedAt);
  const today = startOfLocalDay(now);
  const plannedDay = startOfLocalDay(date);
  const diffDays = Math.round((plannedDay.getTime() - today.getTime()) / 86400000);

  let dayLabel: string;

  if (diffDays === 0) dayLabel = "Today";
  else if (diffDays === 1) dayLabel = "Tomorrow";
  else if (diffDays === -1) dayLabel = "Yesterday";
  else {
    dayLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  if (plannedHasTime) {
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    return `${dayLabel} · ${time}`;
  }

  return dayLabel;
}

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "";

  const date = new Date(`${dueDate}T12:00:00`);

  return `Due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function formatCompletedDate(completedAt: string | null): string {
  if (!completedAt) return "";

  const date = new Date(completedAt);

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function mentalEffortGlyph(effort: string | null): string {
  if (!effort) return "";

  if (effort === "low") return "◇";
  if (effort === "medium") return "◆";

  return "◆◆";
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Convert datetime-local value to ISO string; date-only sets planned_has_time false. */
export function parsePlannedInput(
  value: string,
  includeTime: boolean
): {
  planned_at?: string;
  planned_has_time: boolean;
} {
  if (!value.trim()) return { planned_has_time: false };

  if (includeTime) {
    return { planned_at: new Date(value).toISOString(), planned_has_time: true };
  }

  const date = new Date(`${value}T09:00:00`);

  return { planned_at: date.toISOString(), planned_has_time: false };
}

export function toDatetimeLocalValue(iso: string | null, includeTime: boolean): string {
  if (!iso) return "";

  const date = new Date(iso);

  if (includeTime) {
    const pad = (n: number) => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateInputValue(isoDate: string | null): string {
  if (!isoDate) return "";

  return isoDate.slice(0, 10);
}
