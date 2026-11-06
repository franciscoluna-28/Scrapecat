import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleCard } from "./ScheduleCard";
import type { ReportSchedule } from "@/src/_features/reports/services/reports-api";

function schedule(overrides: Partial<ReportSchedule> = {}): ReportSchedule {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "22222222-2222-4222-8222-222222222222",
    branch: "main",
    cadence: "daily",
    dayOfWeek: 5,
    hour: 12,
    timezone: "America/Caracas",
    enabled: true,
    nextRunAt: "2026-11-09T16:00:00.000Z",
    lastRunAt: null,
    lastSuccessAt: null,
    lastStatus: "idle",
    lastError: null,
    repositoryName: "reports-app",
    providerOwner: "acme",
    gitProvider: "github",
    createdAt: "2026-11-06T16:00:00.000Z",
    updatedAt: "2026-11-06T16:00:00.000Z",
    ...overrides,
  };
}

const noop = vi.fn();

describe("ScheduleCard", () => {
  it("shows a 12pm Caracas schedule as 12pm, not 5am", () => {
    render(
      <ScheduleCard
        schedule={schedule()}
        isRunning={false}
        onRun={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    const text = document.body.textContent ?? "";
    expect(text).toContain("Monday–Friday at 12:00");
    expect(text).toContain("America/Caracas");
    expect(text).not.toContain("()");
    expect(text).not.toContain("5:00");
  });

  it("flags schedules that are missing timezone data", () => {
    render(
      <ScheduleCard
        schedule={schedule({ timezone: "" })}
        isRunning={false}
        onRun={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    expect(
      screen.getByText(/missing timezone data/i),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("()");
  });
});
