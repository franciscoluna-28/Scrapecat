import { describe, expect, it } from "vitest";
import { extractDateFilter } from "@/chat/date-filter";

const NOW = new Date(2026, 6, 4, 12, 0, 0);

describe("extractDateFilter", () => {
  it("returns an empty filter when there is no date signal", () => {
    expect(extractDateFilter("When was encryption added?", NOW)).toEqual({});
  });

  it("parses an explicit month and year", () => {
    expect(extractDateFilter("what was built in august 2026?", NOW)).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      label: "August 2026",
    });
  });

  it("parses a bare year", () => {
    expect(extractDateFilter("changes in 2026", NOW)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      label: "2026",
    });
  });

  it("parses an ISO date", () => {
    expect(extractDateFilter("commits on 2026-08-01", NOW)).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-01",
      label: "2026-08-01",
    });
  });

  it("parses since <month year>", () => {
    expect(extractDateFilter("what changed since january 2026", NOW)).toEqual({
      startDate: "2026-01-01",
      label: "since January 2026",
    });
  });

  it("parses before <month year>", () => {
    expect(extractDateFilter("changes before march 2025", NOW)).toEqual({
      endDate: "2025-03-31",
      label: "before March 2025",
    });
  });

  it("parses prior to <year>", () => {
    expect(extractDateFilter("commits prior to 2026", NOW)).toEqual({
      endDate: "2026-12-31",
      label: "before 2026",
    });
  });

  it("parses between two month-year ranges", () => {
    expect(extractDateFilter("between jan 2025 and march 2025", NOW)).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      label: "between Jan 2025 and March 2025",
    });
  });

  it("parses relative 'last N days'", () => {
    expect(extractDateFilter("commits from the last 30 days", NOW)).toEqual({
      startDate: "2026-06-04",
      endDate: "2026-07-04",
      label: "the last 30 days",
    });
  });

  it("parses 'recently'", () => {
    expect(extractDateFilter("what did we do recently", NOW)).toEqual({
      startDate: "2026-06-04",
      endDate: "2026-07-04",
      label: "the last 30 days",
    });
  });

  it("parses 'this year' and 'last year'", () => {
    expect(extractDateFilter("work this year", NOW)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      label: "this year",
    });
    expect(extractDateFilter("work last year", NOW)).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      label: "last year",
    });
  });

  it("parses 'this month' and 'last month'", () => {
    expect(extractDateFilter("work this month", NOW)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      label: "this month",
    });
    expect(extractDateFilter("work last month", NOW)).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      label: "last month",
    });
  });

  it("parses 'today' and 'yesterday'", () => {
    expect(extractDateFilter("commits today", NOW)).toEqual({
      startDate: "2026-07-04",
      endDate: "2026-07-04",
      label: "today",
    });
    expect(extractDateFilter("commits yesterday", NOW)).toEqual({
      startDate: "2026-07-03",
      endDate: "2026-07-03",
      label: "yesterday",
    });
  });

  it("ignores a month without a year", () => {
    expect(extractDateFilter("what changed in august", NOW)).toEqual({});
  });
});
