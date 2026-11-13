/**
 * Retrieval budgets: how much context each mode may return and how far back to
 * look. These are sizing knobs, not relevance thresholds.
 */
export const RAG_RETRIEVER_BUDGETS = {
  /** Default number of citations returned by a retrieval call (MVP budget). */
  DEFAULT_RETRIEVAL_LIMIT: 5,

  /**
   * Hard ceiling on how many results a caller may request. Kept above the
   * default so eval diagnostics can compare against larger top-k values.
   */
  MAX_RETRIEVAL_LIMIT: 20,

  /**
   * Accuracy-first cap for window summaries. The temporal channel returns the
   * whole window instead of top-k; the cap only protects the prompt token
   * budget.
   */
  TEMPORAL_CONTEXT_LIMIT: 200,

  /**
   * How far back to look when a relative query ("latest", "this week") returns
   * nothing. Anchoring to the newest commit keeps recency questions useful for
   * repos that have not been touched recently.
   */
  RELATIVE_FALLBACK_DAYS: 45,
} as const;

/**
 * Semantic relevance thresholds, expressed as cosine distance (lower is closer).
 * These decide whether evidence is good enough to answer, not how much to return.
 */
export const RAG_SEMANTIC_THRESHOLDS = {
  /**
   * Cosine distance ceiling for a semantic hit. `text-embedding-3-small`
   * distances between a natural-language question and short commit subjects
   * typically land around 0.45–0.65 even when the commits are clearly on-topic,
   * so a tight floor throws away the whole candidate set (the model then
   * reports "no commits").
   */
  MAX_COSINE_DISTANCE: 0.8,

  /**
   * Semantic distance at or below which a hit is strong enough to answer on its
   * own. Between this and ABSTAIN_COSINE_DISTANCE the hit is only moderate
   * evidence and needs lexical corroboration; without it the retriever abstains
   * rather than returning nearest-neighbour noise. Tune from eval diagnostics,
   * not intuition.
   */
  STRONG_COSINE_DISTANCE: 0.55,

  /**
   * Upper distance bound for a semantic hit to count as evidence at all. Weak
   * hits require lexical corroboration to be returned.
   */
  ABSTAIN_COSINE_DISTANCE: 0.7,

  /**
   * Narrow band where query-token corroboration may upgrade a moderate hit.
   * Beyond this, only a real lexical match is accepted; this keeps generic
   * words ("data", "delete") from corroborating unrelated commits.
   */
  CORROBORATION_COSINE_DISTANCE: 0.62,
} as const;

/**
 * Evidence rules for borderline semantic hits: a moderate match is only trusted
 * when the query's own wording appears in the top candidates. This is a cheap
 * lexical corroboration signal, not a reranker.
 */
export const RAG_EVIDENCE_RULES = {
  /**
   * Distinct query content tokens that must appear in candidate commit messages
   * before a moderate semantic hit is accepted. One generic token (e.g. "sync")
   * is not enough.
   */
  MIN_QUERY_TOKEN_MATCHES: 2,

  /** How many nearest semantic candidates are inspected for token matches. */
  CORROBORATION_TOP_CANDIDATES: 3,
} as const;

export const {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_RETRIEVAL_LIMIT,
  TEMPORAL_CONTEXT_LIMIT,
  RELATIVE_FALLBACK_DAYS,
} = RAG_RETRIEVER_BUDGETS;

export const {
  MAX_COSINE_DISTANCE,
  STRONG_COSINE_DISTANCE,
  ABSTAIN_COSINE_DISTANCE,
  CORROBORATION_COSINE_DISTANCE,
} = RAG_SEMANTIC_THRESHOLDS;

export const { MIN_QUERY_TOKEN_MATCHES, CORROBORATION_TOP_CANDIDATES } =
  RAG_EVIDENCE_RULES;
