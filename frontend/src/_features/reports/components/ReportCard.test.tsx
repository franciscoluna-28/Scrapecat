import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportCard } from "./ReportCard";
import type { ReportSummary } from "@/src/_features/reports/services/reports-api";

function report(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "22222222-2222-4222-8222-222222222222",
    branch: "main",
    repositoryName: "reports-app",
    providerOwner: "acme",
    gitProvider: "github",
    summary: "No meaningful changes shipped in this period.",
    provider: null,
    model: null,
    periodStart: "2026-10-30T16:22:00.000Z",
    periodEnd: "2026-11-06T16:22:00.000Z",
    createdAt: "2026-11-06T16:22:00.000Z",
    ...overrides,
  };
}

describe("ReportCard", () => {
  it("labels an empty report as a quiet period instead of no model", () => {
    render(<ReportCard report={report()} onOpen={vi.fn()} />);

    const text = document.body.textContent ?? "";
    expect(text).toContain("Quiet period");
    expect(text).not.toContain("No model used");
  });

  it("shows the model when a report used one", () => {
    render(
      <ReportCard
        report={report({ provider: "openrouter", model: "model-x" })}
        onOpen={vi.fn()}
      />,
    );

    expect(document.body.textContent).toContain("openrouter/model-x");
    expect(document.body.textContent).not.toContain("Quiet period");
  });
});
