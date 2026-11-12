import { CronExpressionParser } from "cron-parser";
import { DEFAULT_INITIAL_LOOKBACK_DAYS } from "@/api/reports/types";

export type NextRunInput = {
  cadence: string;
  dayOfWeek: number;
  hour: number;
  timezone: string;
};

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function computeNextRun(
  schedule: NextRunInput,
  now: Date = new Date(),
): Date {
  const expression =
    schedule.cadence === "weekly"
      ? `0 ${schedule.hour} * * ${schedule.dayOfWeek}`
      : `0 ${schedule.hour} * * 1-5`;

  return CronExpressionParser.parse(expression, {
    currentDate: now,
    tz: schedule.timezone,
  })
    .next()
    .toDate();
}

export function computeInitialPeriodStart(now: Date = new Date()): Date {
  return new Date(
    now.getTime() - DEFAULT_INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
}
