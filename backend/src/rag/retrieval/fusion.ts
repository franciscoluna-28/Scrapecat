export const RRF_K = 60;

export type RankedList<T> = {
  items: T[];
  weight?: number;
};

export type ScoredItem<T> = {
  item: T;
  score: number;
};

/**
 * Reciprocal Rank Fusion: combines ranked lists without score calibration.
 * Each item contributes `weight / (k + rank + 1)`; items appearing in both
 * lists accumulate both contributions, so agreement between channels wins.
 */
export function reciprocalRankFusionScored<T>(
  lists: RankedList<T>[],
  getId: (item: T) => string,
  k: number = RRF_K,
): ScoredItem<T>[] {
  const scores = new Map<string, ScoredItem<T>>();

  for (const { items, weight = 1 } of lists) {
    items.forEach((item, index) => {
      const id = getId(item);
      const contribution = weight / (k + index + 1);
      const entry = scores.get(id);
      if (entry) {
        entry.score += contribution;
      } else {
        scores.set(id, { item, score: contribution });
      }
    });
  }

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

export function reciprocalRankFusion<T>(
  lists: RankedList<T>[],
  getId: (item: T) => string,
  k: number = RRF_K,
): T[] {
  return reciprocalRankFusionScored(lists, getId, k).map((entry) => entry.item);
}
