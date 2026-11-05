import { describe, expect, it } from "vitest";
import { computeMetrics, summarizeMetrics } from "@/eval/metrics";

describe("computeMetrics", () => {
  it("scores a partial hit", () => {
    const metrics = computeMetrics(["a", "b", "c"], ["b", "x"], 3);

    expect(metrics).toMatchObject({
      k: 3,
      relevant: 2,
      retrieved: 3,
      hits: 1,
      hit: true,
      recall: 0.5,
      mrr: 0.5,
    });
    expect(metrics.precision).toBeCloseTo(1 / 3);
    expect(metrics.ndcg).toBeCloseTo(0.6309 / 1.6309, 4);
  });

  it("returns zeroed metrics when nothing matches", () => {
    const metrics = computeMetrics(["a", "b"], ["x"], 2);

    expect(metrics).toMatchObject({
      hits: 0,
      hit: false,
      recall: 0,
      precision: 0,
      mrr: 0,
      ndcg: 0,
    });
  });

  it("counts duplicate retrieved SHAs once", () => {
    const metrics = computeMetrics(["a", "a", "b"], ["a"], 3);

    expect(metrics.hits).toBe(1);
    expect(metrics.recall).toBe(1);
  });

  it("only considers the first k results", () => {
    const metrics = computeMetrics(["a", "b", "c"], ["c"], 2);

    expect(metrics.hit).toBe(false);
  });
});

describe("summarizeMetrics", () => {
  it("averages cases", () => {
    const summary = summarizeMetrics([
      computeMetrics(["a"], ["a"], 1),
      computeMetrics(["a"], ["b"], 1),
    ]);

    expect(summary.cases).toBe(2);
    expect(summary.hitRate).toBe(0.5);
    expect(summary.meanRecall).toBe(0.5);
    expect(summary.mrr).toBe(0.5);
  });

  it("returns zeros for an empty set", () => {
    expect(summarizeMetrics([])).toEqual({
      cases: 0,
      hitRate: 0,
      meanRecall: 0,
      meanPrecision: 0,
      mrr: 0,
      meanNdcg: 0,
    });
  });
});
