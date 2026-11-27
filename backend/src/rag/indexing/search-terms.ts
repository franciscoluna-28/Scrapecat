const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "how",
  "does",
  "did",
  "what",
  "when",
  "where",
  "why",
  "who",
  "are",
  "was",
  "were",
  "is",
  "of",
  "to",
  "in",
  "on",
  "a",
  "an",
  "it",
  "we",
  "you",
  "our",
  "their",
  "has",
  "have",
  "had",
  "be",
  "been",
  "being",
]);

/**
 * Content terms for the lexical channel. We OR these terms in the tsquery so a
 * natural-language question does not require every word to appear in a commit.
 */
export function lexicalSearchTerms(query: string): string[] {
  const tokens = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(tokens)]
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .slice(0, 24);
}
