export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type Cadence = "daily" | "weekly";

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function formatUtc(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(date));
}

export function formatInTimeZone(
  date: string | Date,
  timeZone?: string,
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(date));
}

export function formatUtcWithLocal(date: string | Date): {
  utc: string;
  local: string;
} {
  return {
    utc: formatUtc(date),
    local: formatInTimeZone(date),
  };
}

/** Short, human timezone name: "America/Caracas" → "Caracas". */
export function friendlyTimeZoneLabel(timeZone?: string): string {
  if (!timeZone) return "UTC";
  const segment = timeZone.split("/").pop() ?? timeZone;
  return segment.replace(/_/g, " ");
}

/** The next run in the schedule's timezone, 12-hour, e.g. "Mon, Nov 9, 9:00 AM". */
export function formatNextRun(
  date: string | Date,
  timeZone?: string,
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Countdown to the next run: "in 3 days", "Due now" (within a minute),
 * or "Overdue" — a past next-run must never read as "3 hours ago".
 */
export function formatNextRunRelative(
  date: string | Date,
  now: Date = new Date(),
  locale?: string,
): string {
  const diffMs = new Date(date).getTime() - now.getTime();
  if (Math.abs(diffMs) <= 60_000) return "Due now";
  if (diffMs < 0) return "Overdue";
  return formatRelativeTime(date, now, locale);
}

export function formatRelativeTime(
  date: string | Date,
  now: Date = new Date(),
  locale?: string,
): string {
  const diffMs = new Date(date).getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (abs < 60_000) {
    return formatter.format(Math.round(diffMs / 1000), "second");
  }
  if (abs < 3_600_000) {
    return formatter.format(Math.round(diffMs / 60_000), "minute");
  }
  if (abs < 86_400_000) {
    return formatter.format(Math.round(diffMs / 3_600_000), "hour");
  }
  return formatter.format(Math.round(diffMs / 86_400_000), "day");
}

export function formatPeriod(start: string | Date, end: string | Date): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

/** Date-only period for compact list rows: "Oct 31 – Nov 7". */
export function formatPeriodDate(
  start: string | Date,
  end: string | Date,
  locale?: string,
): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

export function formatPeriodUtc(
  start: string | Date,
  end: string | Date,
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))} UTC`;
}

export function formatHourLocal(hour: number): string {
  const date = new Date(2000, 0, 1, hour, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTimeZoneName(date: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "your time"
  );
}

export function cadenceSummary(input: {
  cadence: string;
  dayOfWeek: number;
  hour: number;
  timezone: string;
}): string {
  const time = formatHourLocal(input.hour);
  if (input.cadence === "weekly") {
    return `Runs every ${WEEKDAYS[input.dayOfWeek] ?? "Friday"} at ${time} (${input.timezone})`;
  }
  return `Runs Monday–Friday at ${time} (${input.timezone})`;
}

export function localCadenceLabel(input: {
  cadence: string;
  nextRunAt: string | Date;
  timezone: string;
}): string {
  const date = new Date(input.nextRunAt);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: input.timezone,
  }).format(date);
  const hour = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: input.timezone,
  }).format(date);

  if (input.cadence === "weekly") {
    return `Weekly on ${day} at ${hour}`;
  }
  return `Monday–Friday at ${hour}`;
}

export function summaryPreview(summary: string, maxLength = 240): string {
  const plain = summary
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // The model often restates the repository branch and period as a header.
  // Drop that boilerplate so the preview shows the actual summary.
  const date =
    "(?:[A-Z][a-z]{2,8}\\.?\\s+\\d{1,2},\\s*\\d{4}|\\d{4}-\\d{2}-\\d{2})";
  const periodHeader = new RegExp(
    `^.*?\\bperiod\\b:?\\s*${date}\\s*(?:to|–|—|-)\\s*${date}[\\.;:]?\\s*`,
    "i",
  );
  const withoutHeader = plain
    .replace(periodHeader, "")
    .replace(/^engineering summary\b[^:]*:\s*/i, "")
    .trim();

  const sentence = withoutHeader.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  const text = sentence || withoutHeader;

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
