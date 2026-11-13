/**
 * Cheap lexical corroboration for borderline semantic hits: does the query's
 * own wording actually appear in the nearest commit messages?
 *
 * Exact-token matching is deliberate. Stemming or prefix matching would let
 * generic fragments corroborate unrelated hits (`apps` -> `app`, `work` ->
 * `worker`), which is exactly the noise this gate exists to reject.
 */

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "just",
  "me",
  "more",
  "most",
  "my",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "on",
  "or",
  "our",
  "out",
  "over",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "work",
  "works",
  "would",
  "you",
  "your",
]);

/**
 * Tokenize text into topical content tokens.
 *
 * Order matters: normalize curly apostrophes, strip possessive `'s`, split,
 * then apply the length and stopword filters.
 *
 * Known corner case: `it's` becomes `it` (dropped by length/stopword), while
 * `its` survives. That asymmetry is accepted rather than special-cased.
 */
export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/'s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

export type QueryTokenMatches = {
  count: number;
  matched: string[];
};

/**
 * Count distinct query content tokens that appear in any of the candidate
 * texts. Callers decide which candidates are relevant (e.g. the top few
 * nearest semantic rows).
 */
export function countQueryTokenMatches(
  query: string,
  candidateTexts: string[],
): QueryTokenMatches {
  const queryTokens = new Set(contentTokens(query));
  const candidateTokens = new Set(
    candidateTexts.flatMap((text) => contentTokens(text)),
  );
  const matched = [...queryTokens].filter((token) =>
    candidateTokens.has(token),
  );
  return { count: matched.length, matched };
}
