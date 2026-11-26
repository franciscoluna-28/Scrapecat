import { afterEach, describe, expect, it } from "vitest";
import { registerJobHandler, resetJobHandlers } from "./registry";
import { runJobInline } from "./worker";

afterEach(() => {
  resetJobHandlers();
});

describe("runJobInline", () => {
  it("runs the registered handler and forwards progress", async () => {
    registerJobHandler("prog", async (_payload, report) => {
      report({ stage: "arch", message: "starting" });
      report({ stage: "ingest", message: "all", done: 2, total: 2 });
      return "ok";
    });
    const frames: unknown[] = [];

    await expect(
      runJobInline("prog", {}, (progress) => frames.push(progress)),
    ).resolves.toBe("ok");
    expect(frames).toEqual([
      { stage: "arch", message: "starting" },
      { stage: "ingest", message: "all", done: 2, total: 2 },
    ]);
  });

  it("propagates structured error codes (BranchNotFound)", async () => {
    registerJobHandler("boom", async () => {
      const error = new Error("branch missing") as Error & { code?: string };
      error.code = "BranchNotFound";
      throw error;
    });

    await expect(runJobInline("boom", {})).rejects.toMatchObject({
      message: "branch missing",
      code: "BranchNotFound",
    });
  });

  it("rejects when no handler is registered", async () => {
    await expect(runJobInline("missing", {})).rejects.toThrow(
      /No job handler registered/,
    );
  });
});
