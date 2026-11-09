import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("@/src/_features/chat/services/projects-api", () => ({
  useProjects: () => ({
    isLoading: false,
    projects: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        gitProvider: "github",
        providerProjectId: "1",
        providerOwner: "acme",
        repositoryName: "reports-app",
        defaultBranch: "main",
        indexedBranches: ["main"],
        createdAt: "2026-11-06T16:00:00.000Z",
        updatedAt: "2026-11-06T16:00:00.000Z",
      },
    ],
  }),
}));

vi.mock("@/src/_features/git-providers/services/git-providers-api", () => ({
  useBranches: () => ({
    branches: ["main"],
    isLoading: false,
  }),
}));

vi.mock("@/src/_features/reports/services/reports-api", () => ({
  useCreateReportSchedule: () => ({
    mutateAsync: mocks.create,
    isPending: false,
    error: null,
  }),
  useUpdateReportSchedule: () => ({
    mutateAsync: mocks.update,
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/src/_features/reports/lib/time", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/_features/reports/lib/time")>();
  return {
    ...actual,
    browserTimeZone: () => "America/Caracas",
  };
});

import { ScheduleDialog } from "./ScheduleDialog";
import { formatHourLocal } from "@/src/_features/reports/lib/time";

describe("ScheduleDialog", () => {
  beforeEach(() => {
    mocks.create.mockReset().mockResolvedValue({});
    mocks.update.mockReset().mockResolvedValue({});
    mocks.onOpenChange.mockReset();
  });

  it("labels the weekday cadence accurately", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <ScheduleDialog open onOpenChange={mocks.onOpenChange} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Cadence" }));

    expect(
      screen.getByRole("option", { name: "Weekdays (Mon–Fri)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Daily" })).not.toBeInTheDocument();
  });

  it("submits 12pm as local hour 12 with the browser timezone", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <ScheduleDialog open onOpenChange={mocks.onOpenChange} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Time" }));
    const option = screen
      .getAllByRole("option")
      .find((item) => item.textContent === formatHourLocal(12));
    expect(option).toBeDefined();
    await user.click(option!);

    await user.click(
      screen.getByRole("button", { name: "Save schedule" }),
    );

    expect(mocks.create).toHaveBeenCalledWith({
      projectId: "22222222-2222-4222-8222-222222222222",
      branch: "main",
      cadence: "daily",
      dayOfWeek: 5,
      hour: 12,
      timezone: "America/Caracas",
    });
  });
});
