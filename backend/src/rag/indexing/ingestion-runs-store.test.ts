import { describe, expect, it, vi } from "vitest";
import { ingestionRuns } from "@/db/schema";
import {
  createIngestionRunsStore,
  type IngestionRunInput,
} from "@/rag/indexing/ingestion-runs-store";

function fakeClient() {
  const values = vi.fn<(input: IngestionRunInput) => Promise<void>>();
  const insert = vi.fn(() => ({ values }));
  const store = createIngestionRunsStore({ insert } as never);
  return { store, insert, values };
}

const input: IngestionRunInput = {
  jobId: null,
  jobType: "ingest-branch",
  projectId: null,
  branch: "main",
  status: "succeeded",
  startedAt: new Date(0),
  finishedAt: new Date(5),
  durationMs: 5,
};

describe("ingestionRunsStore", () => {
  it("inserts one append-only row", async () => {
    const { store, insert, values } = fakeClient();
    values.mockResolvedValueOnce(undefined);

    await store.record(input);

    expect(insert).toHaveBeenCalledWith(ingestionRuns);
    expect(values).toHaveBeenCalledWith(input);
  });

  it("propagates insert failures to the caller", async () => {
    const { store, values } = fakeClient();
    values.mockRejectedValueOnce(new Error("db down"));

    await expect(store.record(input)).rejects.toThrow("db down");
  });
});
