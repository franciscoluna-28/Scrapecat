import { describe, expect, it } from "vitest";
import {
  cadenceLabel,
  computeNextRun,
  formatInTimeZone,
  formatPeriod,
  formatRelativeTime,
  formatUtc,
  formatUtcWithLocal,
  summaryPreview,
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

  it("formats report periods", () => {
    expect(
      formatPeriod(
        "2026-01-02T09:00:00.000Z",
        "2026-01-09T09:00:00.000Z",
      ),
    ).toBe("Jan 2, 09:00 – Jan 9, 09:00 UTC");
  });

  it("labels cadences", () => {
    expect(
      cadenceLabel({ cadence: "daily", dayOfWeek: 5, hourUtc: 9 }),
    ).toBe("Daily at 09:00 UTC");
    expect(
      cadenceLabel({ cadence: "weekly", dayOfWeek: 5, hourUtc: 9 }),
    ).toBe("Weekly on Friday at 09:00 UTC");
  });

  it("creates a plain summary preview", () => {
    expect(
      summaryPreview("## Shipped\n\n- **Reports** and `schedules`"),
    ).toBe("Shipped - Reports and schedules");
  });
});
