import { describe, expect, it } from "vitest";
import {
  computeInitialPeriodStart,
  computeNextRun,
  isValidTimeZone,
} from "@/reports/next-run";

const daily = {
  cadence: "daily",
  dayOfWeek: 5,
  hour: 9,
  timezone: "UTC",
};

const weekly = {
  cadence: "weekly",
  dayOfWeek: 5,
  hour: 9,
  timezone: "UTC",
};

describe("computeNextRun", () => {
  it("returns today when the daily hour is still ahead", () => {
    const now = new Date("2026-01-01T08:00:00.000Z");
    expect(computeNextRun(daily, now)).toEqual(
      new Date("2026-01-01T09:00:00.000Z"),
    );
  });

  it("returns the next weekday when the daily hour has passed", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    expect(computeNextRun(daily, now)).toEqual(
      new Date("2026-01-02T09:00:00.000Z"),
    );
  });

  it("skips the weekend for daily schedules", () => {
    const now = new Date("2026-01-02T10:00:00.000Z");
    expect(computeNextRun(daily, now)).toEqual(
      new Date("2026-01-05T09:00:00.000Z"),
    );
  });

  it("skips a weekend when today is Saturday", () => {
    const now = new Date("2026-01-03T10:00:00.000Z");
    expect(computeNextRun(daily, now)).toEqual(
      new Date("2026-01-05T09:00:00.000Z"),
    );
  });

  it("returns the selected weekday for a weekly schedule", () => {
    const now = new Date("2026-01-05T12:00:00.000Z");
    expect(computeNextRun(weekly, now)).toEqual(
      new Date("2026-01-09T09:00:00.000Z"),
    );
  });

  it("returns the same weekly day when the hour is still ahead", () => {
    const now = new Date("2026-01-02T08:00:00.000Z");
    expect(computeNextRun(weekly, now)).toEqual(
      new Date("2026-01-02T09:00:00.000Z"),
    );
  });

  it("returns next week when the weekly run has passed", () => {
    const now = new Date("2026-01-02T10:00:00.000Z");
    expect(computeNextRun(weekly, now)).toEqual(
      new Date("2026-01-09T09:00:00.000Z"),
    );
  });

  it("supports a non-Friday weekly day", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    expect(
      computeNextRun({ ...weekly, dayOfWeek: 1 }, now),
    ).toEqual(new Date("2026-01-05T09:00:00.000Z"));
  });

  it("computes daily runs in the schedule timezone", () => {
    const schedule = { ...daily, timezone: "America/New_York" };
    expect(
      computeNextRun(schedule, new Date("2026-01-05T13:00:00.000Z")),
    ).toEqual(new Date("2026-01-05T14:00:00.000Z"));
  });

  it("skips the weekend in the schedule timezone", () => {
    const schedule = { ...daily, timezone: "America/New_York" };
    expect(
      computeNextRun(schedule, new Date("2026-01-09T14:01:00.000Z")),
    ).toEqual(new Date("2026-01-12T14:00:00.000Z"));
  });

  it("keeps the local hour across the spring DST change", () => {
    const schedule = { ...daily, timezone: "America/Toronto" };
    expect(
      computeNextRun(schedule, new Date("2026-03-06T14:01:00.000Z")),
    ).toEqual(new Date("2026-03-09T13:00:00.000Z"));
  });

  it("keeps the local hour across the winter fall-back change", () => {
    const schedule = { ...daily, timezone: "America/New_York" };
    expect(
      computeNextRun(schedule, new Date("2026-10-30T14:01:00.000Z")),
    ).toEqual(new Date("2026-11-02T14:00:00.000Z"));
  });

  it("handles Canada's half-hour timezone offset in winter", () => {
    const schedule = { ...daily, timezone: "America/St_Johns" };
    expect(
      computeNextRun(schedule, new Date("2026-01-05T13:00:00.000Z")),
    ).toEqual(new Date("2026-01-06T12:30:00.000Z"));
  });

  it("keeps weekly runs at the local hour after DST ends", () => {
    const schedule = { ...weekly, timezone: "America/New_York" };
    expect(
      computeNextRun(schedule, new Date("2026-11-06T15:00:00.000Z")),
    ).toEqual(new Date("2026-11-13T14:00:00.000Z"));
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA timezones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects unknown timezones", () => {
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("computeInitialPeriodStart", () => {
  it("uses a seven day lookback", () => {
    const now = new Date("2026-01-10T12:00:00.000Z");
    expect(computeInitialPeriodStart(now)).toEqual(
      new Date("2026-01-03T12:00:00.000Z"),
    );
  });
});
