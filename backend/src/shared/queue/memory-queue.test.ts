import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryQueue } from "./memory-queue";
import { registerJobHandler, resetJobHandlers } from "./registry";

beforeEach(() => {
  resetJobHandlers();
});

describe("memory queue", () => {
  it("runs the handler inline and returns its result", async () => {
    registerJobHandler("echo", async (payload) => ({ ...(payload as object) }));
    const queue = createMemoryQueue();

    await queue.enqueue("echo", "j1", { a: 1 });

    expect(await queue.runAndWait("j1")).toEqual({ a: 1 });
  });

  it("forwards progress events to the waiter", async () => {
    registerJobHandler("prog", async (_payload, report) => {
      report({ stage: "arch", message: "starting" });
      report({ stage: "ingest", message: "half", done: 1, total: 2 });
      report({ stage: "ingest", message: "all", done: 2, total: 2 });
      return "ok";
    });
    const queue = createMemoryQueue();
    const frames: unknown[] = [];

    await queue.enqueue("prog", "j2", {});
    const result = await queue.runAndWait("j2", (p) => frames.push(p));

    expect(result).toBe("ok");
    expect(frames).toEqual([
      { stage: "arch", message: "starting" },
      { stage: "ingest", message: "half", done: 1, total: 2 },
      { stage: "ingest", message: "all", done: 2, total: 2 },
    ]);
  });

  it("dedupes concurrent waits onto a single execution", async () => {
    let runs = 0;
    registerJobHandler("slow", async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "done";
    });
    const queue = createMemoryQueue();

    await queue.enqueue("slow", "j3", {});
    const [a, b] = await Promise.all([queue.runAndWait("j3"), queue.runAndWait("j3")]);

    expect(a).toBe("done");
    expect(b).toBe("done");
    expect(runs).toBe(1);
  });

  it("propagates structured error codes (BranchNotFound)", async () => {
    registerJobHandler("boom", async () => {
      const error = new Error("branch missing") as Error & { code?: string };
      error.code = "BranchNotFound";
      throw error;
    });
    const queue = createMemoryQueue();

    await queue.enqueue("boom", "j4", {});
    await expect(queue.runAndWait("j4")).rejects.toMatchObject({
      message: "branch missing",
      code: "BranchNotFound",
    });
  });

  it("rejects when the job was never enqueued", async () => {
    const queue = createMemoryQueue();
    await expect(queue.runAndWait("missing")).rejects.toThrow(/not enqueued/);
  });
});
