export type ContextMetrics = {
  relevant: number;
  hits: number;
  hit: boolean;
  contextRecall: number;
  contextPrecision: number;
  mrr: number;
};

export type ContextMetricsSummary = {
  cases: number;
  meanContextRecall: number;
  meanContextPrecision: number;
  mrr: number;
};

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Label-based context metrics over the first `k` retrieved SHAs.
 *
 * - Context recall: fraction of judged relevant SHAs that were retrieved.
 * - Context precision (rank-aware): each relevant hit contributes the precision
 *   at its rank, averaged over the relevant hits. A single relevant commit at
 *   rank 1 scores 1.0.
 * - MRR: reciprocal rank of the first relevant hit (debugging aid).
 *
 * Duplicate SHAs are counted once.
 */
export function computeMetrics(
  retrievedShas: string[],
  relevantShas: string[],
  k: number,
): ContextMetrics {
  const relevant = new Set(relevantShas);
  const topK = retrievedShas.slice(0, k);
  const seen = new Set<string>();
  let hits = 0;
  let firstHit = -1;
  let precisionSum = 0;

  topK.forEach((sha, index) => {
    if (seen.has(sha)) return;
    seen.add(sha);
    if (!relevant.has(sha)) return;
    hits += 1;
    if (firstHit === -1) firstHit = index;
    precisionSum += hits / (index + 1);
  });

  return {
    relevant: relevant.size,
    hits,
    hit: hits > 0,
    contextRecall: divide(hits, relevant.size),
    contextPrecision: divide(precisionSum, hits),
    mrr: firstHit === -1 ? 0 : 1 / (firstHit + 1),
  };
}

export function summarizeMetrics(
  metrics: ContextMetrics[],
): ContextMetricsSummary {
  const mean = (pick: (metric: ContextMetrics) => number) =>
    divide(
      metrics.reduce((total, metric) => total + pick(metric), 0),
      metrics.length,
    );

  return {
    cases: metrics.length,
    meanContextRecall: mean((metric) => metric.contextRecall),
    meanContextPrecision: mean((metric) => metric.contextPrecision),
    mrr: mean((metric) => metric.mrr),
  };
}
