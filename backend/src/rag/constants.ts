/**
 * Retrieval budgets: how much context each mode may return. These are sizing
 * knobs, not relevance thresholds.
 */
export const RAG_RETRIEVER_BUDGETS = {
  DEFAULT_RETRIEVAL_LIMIT: 5,
  MAX_RETRIEVAL_LIMIT: 20,
  TEMPORAL_CONTEXT_LIMIT: 200,
} as const;

/**
 * The single semantic relevance knob: cosine distance ceiling for a semantic
 * hit. Calibrate it from the golden-set eval, not intuition.
 */
export const MAX_COSINE_DISTANCE = 0.8;

export const {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_RETRIEVAL_LIMIT,
  TEMPORAL_CONTEXT_LIMIT,
} = RAG_RETRIEVER_BUDGETS;

/** Returned without calling the model when retrieval found no commits. */
export const NO_INDEXED_COMMITS_MESSAGE =
  "No indexed commits matched this branch or date window. If you just connected the repository, ingestion may still be running or may have failed — check the backend logs and jobs.";
