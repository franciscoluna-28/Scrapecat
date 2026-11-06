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

export function computeNextRun(
  input: { cadence: Cadence; dayOfWeek: number; hourUtc: number },
  now: Date = new Date(),
): Date {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      input.hourUtc,
      0,
      0,
      0,
    ),
  );

  if (input.cadence === "weekly") {
    const target = ((input.dayOfWeek % 7) + 7) % 7;
    const delta = (target - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + delta);
  }

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + (input.cadence === "weekly" ? 7 : 1));
  }

  return next;
}

export function computeNextLocalRun(
  input: { cadence: Cadence; dayOfWeek: number; hour: number },
  now: Date = new Date(),
): Date {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    input.hour,
    0,
    0,
    0,
  );

  if (input.cadence === "weekly") {
    const target = ((input.dayOfWeek % 7) + 7) % 7;
    const delta = (target - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + delta);
  }

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + (input.cadence === "weekly" ? 7 : 1));
  }

  return next;
}

export function localScheduleToUtc(
  input: { cadence: Cadence; dayOfWeek: number; hour: number },
  now: Date = new Date(),
): { cadence: Cadence; dayOfWeek: number; hourUtc: number } {
  const next = computeNextLocalRun(input, now);
  return {
    cadence: input.cadence,
    dayOfWeek: next.getUTCDay(),
    hourUtc: next.getUTCHours(),
  };
}

export function utcScheduleToLocal(
  input: { cadence: Cadence; dayOfWeek: number; hourUtc: number },
  now: Date = new Date(),
): { cadence: Cadence; dayOfWeek: number; hour: number } {
  const next = computeNextRun(input, now);
  return {
    cadence: input.cadence,
    dayOfWeek: next.getDay(),
    hour: next.getHours(),
  };
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

export function localCadenceLabel(input: {
  cadence: string;
  nextRunAt: string | Date;
}): string {
  const date = new Date(input.nextRunAt);
  const day = WEEKDAYS[date.getDay()];
  const hour = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (input.cadence === "weekly") {
    return `Weekly on ${day} at ${hour}`;
  }
  return `Daily at ${hour}`;
}

export function summaryPreview(summary: string, maxLength = 240): string {
  const plain = summary
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}
