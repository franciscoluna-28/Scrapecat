import { describe, expect, it } from "vitest";
import {
  browserTimeZone,
  cadenceSummary,
  formatHourLocal,
  formatInTimeZone,
  formatNextRun,
  formatNextRunRelative,
  formatPeriodDate,
  formatPeriodUtc,
  formatRelativeTime,
  formatUtc,
  formatUtcWithLocal,
  friendlyTimeZoneLabel,
  localCadenceLabel,
  summaryPreview,
} from "./time";

describe("timezone helpers", () => {
  it("returns a browser timezone", () => {
    expect(browserTimeZone()).toBeTruthy();
  });
});

describe("cadence labels", () => {
  it("describes daily weekday reports", () => {
    expect(
      cadenceSummary({
        cadence: "daily",
        dayOfWeek: 5,
        hour: 9,
        timezone: "America/New_York",
      }),
    ).toMatch(/^Runs Monday–Friday at .+ \(America\/New_York\)$/);
  });

  it("describes weekly reports", () => {
    expect(
      cadenceSummary({
        cadence: "weekly",
        dayOfWeek: 5,
        hour: 9,
        timezone: "America/New_York",
      }),
    ).toMatch(/^Runs every Friday at .+ \(America\/New_York\)$/);
  });

  it("uses the schedule timezone for the next run", () => {
    expect(
      localCadenceLabel({
        cadence: "weekly",
        nextRunAt: "2026-01-09T14:00:00.000Z",
        timezone: "America/New_York",
      }),
    ).toMatch(/^Weekly on Friday at .+/);
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

  it("formats a compact date-only report period", () => {
    expect(
      formatPeriodDate(
        "2026-10-31T17:58:00.000Z",
        "2026-11-07T17:58:00.000Z",
        "en-US",
      ),
    ).toBe("Oct 31 – Nov 7");
  });

  it("formats local hours", () => {
    expect(formatHourLocal(9)).toMatch(/9:00/);
  });

  it("creates a plain summary preview", () => {
    expect(
      summaryPreview("## Shipped\n\n- **Reports** and `schedules`"),
    ).toBe("Shipped - Reports and schedules");
  });
});

describe("next run", () => {
  // 12:00 in Caracas (UTC-4).
  const nextRunAt = "2026-11-09T16:00:00.000Z";

  it("renders the next run in the schedule timezone, 12-hour", () => {
    expect(formatNextRun(nextRunAt, "America/Caracas", "en-US")).toBe(
      "Mon, Nov 9, 12:00 PM",
    );
  });

  it("shortens timezone ids to a friendly label", () => {
    expect(friendlyTimeZoneLabel("America/Caracas")).toBe("Caracas");
    expect(friendlyTimeZoneLabel("America/Argentina/Buenos_Aires")).toBe(
      "Buenos Aires",
    );
    expect(friendlyTimeZoneLabel("UTC")).toBe("UTC");
    expect(friendlyTimeZoneLabel("")).toBe("UTC");
    expect(friendlyTimeZoneLabel(undefined)).toBe("UTC");
  });

  it("counts down to the next run", () => {
    const now = new Date("2026-11-06T16:00:00.000Z");
    expect(formatNextRunRelative(nextRunAt, now, "en-US")).toBe("in 3 days");
  });

  it("says Due now within a minute and Overdue after it", () => {
    expect(
      formatNextRunRelative(nextRunAt, new Date("2026-11-09T15:59:30.000Z")),
    ).toBe("Due now");
    expect(
      formatNextRunRelative(nextRunAt, new Date("2026-11-09T16:30:00.000Z")),
    ).toBe("Overdue");
  });
});
