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

export function formatHourUtc(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00 UTC`;
}

export function cadenceLabel(input: {
  cadence: string;
  dayOfWeek: number;
  hourUtc: number;
}): string {
  if (input.cadence === "weekly") {
    return `Weekly on ${WEEKDAYS[input.dayOfWeek] ?? "Friday"} at ${formatHourUtc(input.hourUtc)}`;
  }
  return `Daily at ${formatHourUtc(input.hourUtc)}`;
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
