import { DEFAULT_INITIAL_LOOKBACK_DAYS } from "@/reports/types";

export type NextRunInput = {
  cadence: string;
  dayOfWeek: number;
  hourUtc: number;
};

export function computeNextRun(
  schedule: NextRunInput,
  now: Date = new Date(),
): Date {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      schedule.hourUtc,
      0,
      0,
      0,
    ),
  );

  if (schedule.cadence === "weekly") {
    const target = ((schedule.dayOfWeek % 7) + 7) % 7;
    const delta = (target - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + delta);
  }

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(
      next.getUTCDate() + (schedule.cadence === "weekly" ? 7 : 1),
    );
  }

  return next;
}

export function computeInitialPeriodStart(now: Date = new Date()): Date {
  return new Date(
    now.getTime() - DEFAULT_INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
}
