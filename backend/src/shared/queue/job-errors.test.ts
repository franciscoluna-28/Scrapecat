import { describe, it, expect } from "vitest";
import { serializeJobError, deserializeJobError } from "./job-errors";

describe("job error encoding", () => {
  it("round-trips message and code", () => {
    const error = new Error("nope") as Error & { code?: string };
    error.code = "BranchNotFound";

    const restored = deserializeJobError(serializeJobError(error));

    expect(restored.message).toBe("nope");
    expect((restored as { code?: string }).code).toBe("BranchNotFound");
  });

  it("passes through non-encoded failures", () => {
    expect(deserializeJobError("redis unavailable").message).toBe("redis unavailable");
    expect(deserializeJobError(undefined).message).toBe("Job failed");
  });
});
