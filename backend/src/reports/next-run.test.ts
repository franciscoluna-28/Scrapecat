import { describe, expect, it } from "vitest";
import {
  computeInitialPeriodStart,
  computeNextRun,
} from "@/reports/next-run";

describe("computeNextRun", () => {
  it("returns today when the daily hour is still ahead", () => {
    const now = new Date("2026-01-01T08:00:00.000Z");
    expect(
      computeNextRun({ cadence: "daily", dayOfWeek: 5, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-01T09:00:00.000Z"));
  });

  it("returns tomorrow when the daily hour has passed", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    expect(
      computeNextRun({ cadence: "daily", dayOfWeek: 5, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-02T09:00:00.000Z"));
  });

  it("returns the selected weekday for a weekly schedule", () => {
    const now = new Date("2026-01-05T12:00:00.000Z");
    expect(
      computeNextRun({ cadence: "weekly", dayOfWeek: 5, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-09T09:00:00.000Z"));
  });

  it("returns the same weekly day when the hour is still ahead", () => {
    const now = new Date("2026-01-02T08:00:00.000Z");
    expect(
      computeNextRun({ cadence: "weekly", dayOfWeek: 5, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-02T09:00:00.000Z"));
  });

  it("returns next week when the weekly run has passed", () => {
    const now = new Date("2026-01-02T10:00:00.000Z");
    expect(
      computeNextRun({ cadence: "weekly", dayOfWeek: 5, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-09T09:00:00.000Z"));
  });

  it("supports a non-Friday weekly day", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    expect(
      computeNextRun({ cadence: "weekly", dayOfWeek: 1, hourUtc: 9 }, now),
    ).toEqual(new Date("2026-01-05T09:00:00.000Z"));
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
