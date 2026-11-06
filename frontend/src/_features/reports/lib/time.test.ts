import { describe, expect, it } from "vitest";
import {
  computeNextLocalRun,
  computeNextRun,
  formatHourLocal,
  formatInTimeZone,
  formatPeriodUtc,
  formatRelativeTime,
  formatUtc,
  formatUtcWithLocal,
  localCadenceLabel,
  localScheduleToUtc,
  summaryPreview,
  utcScheduleToLocal,
} from "./time";

describe("computeNextRun", () => {
  it("returns today when the daily hour is ahead", () => {
    const now = new Date("2026-01-01T08:00:00.000Z");
    expect(
      computeNextRun({ cadence: "daily", dayOfWeek: 5, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-01T09:00:00.000Z"));
  });

  it("returns the next Friday for a weekly schedule", () => {
    const now = new Date("2026-01-05T12:00:00.000Z");
    expect(
      computeNextRun({ cadence: "weekly", dayOfWeek: 5, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-09T09:00:00.000Z"));
  });

  it("supports a custom weekday", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    expect(
      computeNextRun({ cadence: "weekly", dayOfWeek: 1, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-05T09:00:00.000Z"));
  });
});

describe("local schedules", () => {
  it("keeps the local day and hour through a UTC round trip", () => {
    const now = new Date("2026-01-05T12:00:00.000Z");
    const local = { cadence: "weekly" as const, dayOfWeek: 5, hour: 9 };
    const utc = localScheduleToUtc(local, now);

    expect(utcScheduleToLocal(utc, now)).toEqual(local);
  });

  it("computes the next local run", () => {
    const now = new Date("2026-01-05T12:00:00.000Z");
    const next = computeNextLocalRun(
      { cadence: "weekly", dayOfWeek: 5, hour: 9 },
      now,
    );

    expect(next.getDay()).toBe(5);
    expect(next.getHours()).toBe(9);
  });
});

describe("formatting", () => {
  const date = new Date("2026-01-09T09:00:00.000Z");

  it("formats UTC timestamps", () => {
    expect(formatUtc(date)).toBe("Jan 9, 09:00 UTC");
  });

  it("formats a timestamp in an explicit timezone", () => {
    expect(formatInTimeZone(date, "America/New_York", "en-US")).toBe(
      "Fri, Jan 9, 04:00 EST",
    );
  });

  it("returns UTC and local values together", () => {
    expect(formatUtcWithLocal(date).utc).toBe("Jan 9, 09:00 UTC");
  });

  it("formats relative times", () => {
    const now = new Date("2026-01-09T09:05:00.000Z");
    expect(formatRelativeTime(date, now, "en-US")).toBe("5 minutes ago");
  });

  it("formats UTC report periods", () => {
    expect(
      formatPeriodUtc(
        "2026-01-02T09:00:00.000Z",
        "2026-01-09T09:00:00.000Z",
      ),
    ).toBe("Jan 2, 09:00 – Jan 9, 09:00 UTC");
  });

  it("formats local hours", () => {
    expect(formatHourLocal(9)).toMatch(/9:00/);
  });

  it("labels cadences in local time", () => {
    expect(
      localCadenceLabel({
        cadence: "weekly",
        nextRunAt: "2026-01-09T09:00:00.000Z",
      }),
    ).toMatch(/^Weekly on .+ at .+/);
  });

  it("creates a plain summary preview", () => {
    expect(
      summaryPreview("## Shipped\n\n- **Reports** and `schedules`"),
    ).toBe("Shipped - Reports and schedules");
  });
});
