export type RetrievalMetrics = {
  k: number;
  relevant: number;
  retrieved: number;
  hits: number;
  hit: boolean;
  recall: number;
  precision: number;
  mrr: number;
  ndcg: number;
};

export type MetricsSummary = {
  cases: number;
  hitRate: number;
  meanRecall: number;
  meanPrecision: number;
  mrr: number;
  meanNdcg: number;
};

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Binary-relevance metrics over the first `k` retrieved SHAs. `relevantShas` is
 * the judged set of commits that should answer the query, so recall is measured
 * against the labels we actually have, not against every possible commit.
 */
export function computeMetrics(
  retrievedShas: string[],
  relevantShas: string[],
  k: number,
): RetrievalMetrics {
  const relevant = new Set(relevantShas);
  const topK = retrievedShas.slice(0, k);
  const uniqueTopK = [...new Set(topK)];
  const hits = uniqueTopK.filter((sha) => relevant.has(sha)).length;

  const firstHit = topK.findIndex((sha) => relevant.has(sha));
  const mrr = firstHit === -1 ? 0 : 1 / (firstHit + 1);

  let dcg = 0;
  topK.forEach((sha, index) => {
    if (relevant.has(sha)) dcg += 1 / Math.log2(index + 2);
  });

  let idcg = 0;
  for (let i = 0; i < Math.min(relevant.size, k); i += 1) {
    idcg += 1 / Math.log2(i + 2);
  }

  return {
    k,
    relevant: relevant.size,
    retrieved: topK.length,
    hits,
    hit: hits > 0,
    recall: divide(hits, relevant.size),
    precision: divide(hits, k),
    mrr,
    ndcg: divide(dcg, idcg),
  };
}

export function summarizeMetrics(metrics: RetrievalMetrics[]): MetricsSummary {
  if (metrics.length === 0) {
    return {
      cases: 0,
      hitRate: 0,
      meanRecall: 0,
      meanPrecision: 0,
      mrr: 0,
      meanNdcg: 0,
    };
  }

  const mean = (pick: (metric: RetrievalMetrics) => number) =>
    metrics.reduce((total, metric) => total + pick(metric), 0) / metrics.length;

  return {
    cases: metrics.length,
    hitRate: metrics.filter((metric) => metric.hit).length / metrics.length,
    meanRecall: mean((metric) => metric.recall),
    meanPrecision: mean((metric) => metric.precision),
    mrr: mean((metric) => metric.mrr),
    meanNdcg: mean((metric) => metric.ndcg),
  };
}
