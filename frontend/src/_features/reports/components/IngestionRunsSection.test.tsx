import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseIngestionRuns = vi.hoisted(() => vi.fn());

vi.mock("@/src/_features/reports/services/reports-api", () => ({
  useIngestionRuns: mockUseIngestionRuns,
}));

import { IngestionRunsSection } from "./IngestionRunsSection";
import type {
  IngestionRun,
  IngestionRunSummary,
} from "@/src/_features/reports/services/reports-api";

function run(overrides: Partial<IngestionRun> = {}): IngestionRun {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    jobType: "ingest-branch",
    status: "succeeded",
    projectId: "22222222-2222-4222-8222-222222222222",
    branch: "main",
    repositoryName: "reports-app",
    providerOwner: "acme",
    gitProvider: "github",
    startedAt: "2026-01-10T12:00:00.000Z",
    finishedAt: "2026-01-10T12:00:01.200Z",
    durationMs: 1200,
    gitMs: 900,
    dbMs: 100,
    embeddingMs: 800,
    commitsFound: 3,
    commitsWritten: 3,
    commitsEmbedded: 2,
    embeddingProvider: "openrouter",
    embeddingModel: "openai/text-embedding-3-small",
    embeddingInputTokens: 4200,
    embeddingOutputTokens: 0,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

const summary: IngestionRunSummary = {
  windowDays: 7,
  runs: 2,
  failedRuns: 1,
  commitsProcessed: 8,
  embeddingsProcessed: 5,
  avgDurationMs: 1200,
  embeddingInputTokens: 8400,
  embeddingOutputTokens: 120,
};

function mockResult(overrides: Record<string, unknown> = {}) {
  mockUseIngestionRuns.mockReturnValue({
    runs: [],
    summary: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
}

describe("IngestionRunsSection", () => {
  beforeEach(() => {
    mockUseIngestionRuns.mockReset();
  });

  it("shows the window summary and an ingestion run", () => {
    mockResult({ runs: [run()], summary });

    render(<IngestionRunsSection />);

    expect(screen.getByText("acme/reports-app")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(
      screen.getByText(
        "3 commits · 4.2k in · 0 out · git 900ms · db 100ms",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("2 runs")).toBeInTheDocument();
    expect(screen.getByText("8 commits")).toBeInTheDocument();
    expect(screen.getByText("8.4k in · 120 out")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("Last 7d")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText("1.2s")).toBeInTheDocument();
  });

  it("shows the raw run data when See more is clicked", () => {
    mockResult({ runs: [run()], summary });

    render(<IngestionRunsSection />);
    fireEvent.click(screen.getByRole("button", { name: "See more" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/"embeddingInputTokens": 4200/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/"embeddingOutputTokens": 0/),
    ).toBeInTheDocument();
  });

  it("distinguishes a global reindex run", () => {
    mockResult({
      runs: [
        run({
          projectId: null,
          branch: null,
          repositoryName: null,
          providerOwner: null,
          gitProvider: null,
          commitsWritten: null,
          commitsEmbedded: 5,
          jobType: "reindex-embeddings",
          gitMs: null,
          dbMs: 5,
        }),
      ],
      summary,
    });

    render(<IngestionRunsSection />);

    expect(screen.getByText("Embedding reindex")).toBeInTheDocument();
    expect(screen.getByText("all repositories")).toBeInTheDocument();
    expect(
      screen.getByText(
        "5 re-embedded · 4.2k in · 0 out · db 5ms",
      ),
    ).toBeInTheDocument();
  });

  it("shows a failed run with its error", () => {
    mockResult({
      runs: [run({ status: "failed", errorMessage: "branch missing" })],
      summary,
    });

    render(<IngestionRunsSection />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("branch missing");
  });

  it("renders the empty state", () => {
    mockResult();

    render(<IngestionRunsSection />);

    expect(screen.getByText("No ingestion runs yet")).toBeInTheDocument();
  });

  it("renders an error and retries", () => {
    const refetch = vi.fn();
    mockResult({ error: new Error("db down"), refetch });

    render(<IngestionRunsSection />);

    expect(screen.getByText("db down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
