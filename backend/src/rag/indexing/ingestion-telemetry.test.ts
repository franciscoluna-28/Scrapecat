import { describe, expect, it, vi } from "vitest";
import type { IngestionRunInput } from "@/rag/indexing/ingestion-runs-store";
import { createIngestionTelemetry } from "@/rag/indexing/ingestion-telemetry";

const JOB_ID = "123E4567-E89B-12D3-A456-426614174000";
const PROJECT_ID = "abcdefab-cdef-4bcd-8def-abcdefabcdef";

function setup(clocks: number[], elapsedClocks: number[] = clocks) {
  const record = vi
    .fn<(input: IngestionRunInput) => Promise<void>>()
    .mockResolvedValue(undefined);
  const warn = vi.fn();
  let clockIndex = 0;
  let elapsedIndex = 0;
  const clock = () => clocks[Math.min(clockIndex++, clocks.length - 1)]!;
  const elapsed = () =>
    elapsedClocks[Math.min(elapsedIndex++, elapsedClocks.length - 1)]!;
  const telemetry = createIngestionTelemetry({
    store: { record },
    clock,
    elapsed,
    log: { warn },
  });
  return { record, warn, telemetry };
}

function row(record: ReturnType<typeof setup>["record"], index = 0) {
  return record.mock.calls[index]![0];
}

describe("ingestion telemetry", () => {
  it("records a successful run with sanitized ids and timing", async () => {
    const { record, telemetry } = setup([1_000, 1_500]);
    const run = telemetry.start({
      jobId: JOB_ID,
      jobType: "ingest-branch",
      projectId: PROJECT_ID,
      branch: "  main  ",
    });

    await run.finish({
      commitsFound: 3,
      commitsWritten: 2,
      commitsEmbedded: 1,
      gitMs: 400.4,
      dbMs: 30.2,
      embeddingMs: 120.4,
    });

    expect(record).toHaveBeenCalledTimes(1);
    expect(row(record)).toStrictEqual({
      jobId: JOB_ID.toLowerCase(),
      jobType: "ingest-branch",
      projectId: PROJECT_ID,
      branch: "main",
      startedAt: new Date(1_000),
      finishedAt: new Date(1_500),
      durationMs: 500,
      status: "succeeded",
      commitsFound: 3,
      commitsWritten: 2,
      commitsEmbedded: 1,
      gitMs: 400,
      dbMs: 30,
      embeddingMs: 120,
    });
  });

  it("drops inline job ids, invalid project ids, and blank branches", async () => {
    const { record, telemetry } = setup([10, 20]);
    const run = telemetry.start({
      jobId: "inline:ingest-branch",
      jobType: "ingest-branch",
      projectId: "not-a-uuid",
      branch: "   ",
    });

    await run.finish();

    const input = row(record);
    expect(input.jobId).toBeNull();
    expect(input.projectId).toBeNull();
    expect(input.branch).toBeNull();
    expect(input).not.toHaveProperty("commitsFound");
    expect(input).not.toHaveProperty("embeddingMs");
    expect(input).not.toHaveProperty("errorMessage");
  });

  it("records the embedding space and tokens", async () => {
    const { record, telemetry } = setup([0, 10]);
    const run = telemetry.start({ jobType: "ingest-branch" });

    await run.finish({
      embeddingProvider: " openrouter ",
      embeddingModel: " openai/text-embedding-3-small ",
      embeddingInputTokens: 42.6,
      embeddingOutputTokens: 7.2,
    });

    const input = row(record);
    expect(input.embeddingProvider).toBe("openrouter");
    expect(input.embeddingModel).toBe("openai/text-embedding-3-small");
    expect(input.embeddingInputTokens).toBe(43);
    expect(input.embeddingOutputTokens).toBe(7);
  });

  it("normalizes blank embedding metadata and drops junk tokens", async () => {
    const { record, telemetry } = setup([0, 10]);
    const run = telemetry.start({ jobType: "reindex-embeddings" });

    await run.finish({
      embeddingProvider: "   ",
      embeddingModel: 42 as unknown as string,
      embeddingInputTokens: Number.NaN,
      embeddingOutputTokens: -1,
    });

    const input = row(record);
    expect(input.embeddingProvider).toBeNull();
    expect(input.embeddingModel).toBeNull();
    expect(input).not.toHaveProperty("embeddingInputTokens");
    expect(input).not.toHaveProperty("embeddingOutputTokens");
  });

  it("drops junk counters instead of persisting them", async () => {
    const { record, telemetry } = setup([0, 20]);
    const run = telemetry.start({ jobType: "ingest-branch" });

    await run.finish({
      commitsFound: -5,
      commitsWritten: Number.NaN,
      commitsEmbedded: 2.6,
      embeddingMs: Number.POSITIVE_INFINITY,
    });

    const input = row(record);
    expect(input.commitsEmbedded).toBe(3);
    expect(input).not.toHaveProperty("commitsFound");
    expect(input).not.toHaveProperty("commitsWritten");
    expect(input).not.toHaveProperty("embeddingMs");
  });

  it("clamps a backwards clock to zero duration", async () => {
    const { record, telemetry } = setup([500, 400]);
    const run = telemetry.start({ jobType: "reindex-embeddings" });

    await run.finish();

    const input = row(record);
    expect(input.durationMs).toBe(0);
    expect(input.finishedAt).toStrictEqual(new Date(400));
  });

  it("uses monotonic time for duration when wall time steps", async () => {
    const { record, telemetry } = setup([10_000, 9_000], [100, 600]);
    const run = telemetry.start({ jobType: "ingest-branch" });

    await run.finish();

    const input = row(record);
    expect(input.startedAt).toStrictEqual(new Date(10_000));
    expect(input.finishedAt).toStrictEqual(new Date(9_000));
    expect(input.durationMs).toBe(500);
  });

  it("records a failed run with a code, message, and optional counters", async () => {
    const { record, telemetry } = setup([100, 175]);
    const run = telemetry.start({
      jobId: JOB_ID,
      jobType: "ingest-branch",
    });

    await run.fail(
      Object.assign(new Error("branch missing"), { code: "BranchNotFound" }),
      { commitsFound: 4 },
    );

    expect(row(record)).toStrictEqual({
      jobId: JOB_ID.toLowerCase(),
      jobType: "ingest-branch",
      projectId: null,
      branch: null,
      startedAt: new Date(100),
      finishedAt: new Date(175),
      durationMs: 75,
      status: "failed",
      commitsFound: 4,
      errorCode: "BranchNotFound",
      errorMessage: "branch missing",
    });
  });

  it("ignores a second settle and warns", async () => {
    const { record, warn, telemetry } = setup([0, 10, 99]);
    const run = telemetry.start({ jobType: "ingest-branch" });

    await run.finish();
    await run.fail(new Error("too late"));

    expect(record).toHaveBeenCalledTimes(1);
    expect(row(record).status).toBe("succeeded");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toBe("duplicate ingestion run result ignored");
  });

  it("keeps the failed result when finish is called afterwards", async () => {
    const { record, warn, telemetry } = setup([0, 5, 50]);
    const run = telemetry.start({ jobType: "ingest-branch" });

    await run.fail("boom");
    await run.finish({ commitsFound: 9 });

    expect(record).toHaveBeenCalledTimes(1);
    const input = row(record);
    expect(input.status).toBe("failed");
    expect(input.errorMessage).toBe("boom");
    expect(input).not.toHaveProperty("commitsFound");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("swallows persistence failures and warns", async () => {
    const { record, warn, telemetry } = setup([0, 10]);
    record.mockRejectedValueOnce(new Error("db down"));
    const run = telemetry.start({ jobType: "reindex-embeddings" });

    await expect(run.finish()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatchObject({ err: "db down" });
    expect(warn.mock.calls[0]![1]).toBe("ingestion telemetry write failed");
  });

  const oddErrors: Array<{
    label: string;
    error: unknown;
    code: string | undefined;
    message: string;
  }> = [
    {
      label: "message-less error falls back to its name",
      error: Object.assign(new Error(""), { name: "FancyError" }),
      code: undefined,
      message: "FancyError",
    },
    {
      label: "numeric codes are stringified",
      error: { message: "rate limited", code: 429 },
      code: "429",
      message: "rate limited",
    },
    {
      label: "non-string messages are rendered",
      error: { message: 42 },
      code: undefined,
      message: "42",
    },
    {
      label: "arbitrary objects become unknown",
      error: {
        toString: () => {
          throw new Error("nope");
        },
      },
      code: undefined,
      message: "Unknown error",
    },
    {
      label: "null becomes unknown",
      error: null,
      code: undefined,
      message: "Unknown error",
    },
  ];

  it.each(oddErrors)(
    "renders odd errors: $label",
    async ({ error, code, message }) => {
      const { record, telemetry } = setup([0, 1]);
      const run = telemetry.start({ jobType: "ingest-branch" });

      await run.fail(error);

      const input = row(record);
      expect(input.errorMessage).toBe(message);
      if (code === undefined) {
        expect(input).not.toHaveProperty("errorCode");
      } else {
        expect(input.errorCode).toBe(code);
      }
    },
  );

  it("truncates oversized error messages", async () => {
    const { record, telemetry } = setup([0, 1]);
    const run = telemetry.start({ jobType: "ingest-branch" });

    await run.fail(new Error("x".repeat(2_500)));

    const input = row(record);
    expect(input.errorMessage).toHaveLength(2_003);
    expect(input.errorMessage?.endsWith("...")).toBe(true);
  });
});
