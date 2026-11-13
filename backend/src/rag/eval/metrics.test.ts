import { describe, expect, it } from "vitest";
import { computeMetrics, summarizeMetrics } from "@/rag/eval/metrics";

describe("computeMetrics", () => {
  it("scores a rank-1 hit as perfect precision and full MRR", () => {
    const metrics = computeMetrics(["a", "b"], ["a"], 10);

    expect(metrics).toMatchObject({
      hits: 1,
      hit: true,
      contextRecall: 1,
      contextPrecision: 1,
      mrr: 1,
    });
  });

  it("averages precision over relevant hits at their ranks", () => {
    // Relevant hits at ranks 2 and 3: (1/2 + 2/3) / 2
    const metrics = computeMetrics(["x", "a", "b"], ["a", "b"], 3);

    expect(metrics.contextPrecision).toBeCloseTo(7 / 12);
    expect(metrics.contextRecall).toBe(1);
    expect(metrics.mrr).toBe(0.5);
  });

  it("scores partial recall against the judged set", () => {
    const metrics = computeMetrics(["a", "b", "c"], ["b", "x"], 3);

    expect(metrics.contextRecall).toBe(0.5);
    expect(metrics.contextPrecision).toBe(0.5);
  });

  it("returns zeros without NaN when nothing matches", () => {
    const metrics = computeMetrics(["a", "b"], ["x"], 2);

    expect(metrics).toMatchObject({
      hits: 0,
      hit: false,
      contextRecall: 0,
      contextPrecision: 0,
      mrr: 0,
    });
  });

  it("counts duplicate retrieved SHAs once and ignores results beyond k", () => {
    expect(computeMetrics(["a", "a", "b"], ["a"], 3).hits).toBe(1);
    expect(computeMetrics(["a", "b", "c"], ["c"], 2).hit).toBe(false);
  });
});

describe("summarizeMetrics", () => {
  it("averages cases and returns zeros for an empty set", () => {
    const summary = summarizeMetrics([
      computeMetrics(["a"], ["a"], 1),
      computeMetrics(["a"], ["b"], 1),
    ]);

    expect(summary).toEqual({
      cases: 2,
      meanContextRecall: 0.5,
      meanContextPrecision: 0.5,
      mrr: 0.5,
    });
    expect(summarizeMetrics([])).toEqual({
      cases: 0,
      meanContextRecall: 0,
      meanContextPrecision: 0,
      mrr: 0,
    });
  });
});
