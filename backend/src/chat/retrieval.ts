import type { ChatCitation } from "@/db/schema";
import { embedTexts } from "@/projects/embeddings";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import type { CommitSearchResult } from "@/projects/stores/commit-chunks-store";

export const RETRIEVAL_LIMIT = 30;

/**
 * Minimum cosine similarity (1 - cosine distance) for a semantic-search hit to
 * be cited. Small or precise questions therefore cite only commits that are
 * actually about the topic instead of always filling up to RETRIEVAL_LIMIT.
 * Keyword hits are exempt: they matched the query text literally.
 */
export const MIN_SIMILARITY = 0.3;

/**
 * Relaxed floor when the query carries an explicit date window: the window is
 * the primary filter, so topical similarity matters less. If nothing clears
 * even this floor, the window's most important commits are returned anyway
 * (ranked by importance) instead of an empty result — "what shipped in
 * August" must not fail just because commit messages never say "shipped".
 */
export const WINDOWED_MIN_SIMILARITY = 0.15;

const CANDIDATE_POOL = 120;

const COMMIT_BOOST: Record<string, number> = {
  "feat!": 5,
  feat: 4,
  "fix!": 4,
  "refactor!": 3,
  breaking: 4,
  fix: 2,
  refactor: 1,
  docs: 0.5,
  chore: 0.5,
  test: 0.5,
};

function importanceScore(row: CommitSearchResult, similarity: number): number {
  let boost = 0;
  const msg = row.commitMessage;
  const prefix = msg.match(/^(\w+!?)(?:\(.+?\))?!?/)?.[1];
  if (prefix) boost = COMMIT_BOOST[prefix.toLowerCase()] ?? 0;
  if (msg.startsWith("Merge pull request")) boost += 3;
  if (/breaking|BREAKING/i.test(msg)) boost += 4;
  const files = row.metadata?.filesChanged?.length ?? 0;
  if (files >= 20) boost += 3;
  else if (files >= 10) boost += 2;
  else if (files >= 5) boost += 1;
  return similarity * 0.5 + boost * 0.5;
}

function similarityOf(row: CommitSearchResult, index: number): number {
  if (row.distance == null) {
    // Keyword fallback has no score — rank position is the only signal.
    return 1 - index / CANDIDATE_POOL;
  }
  // pgvector cosine distance is in [0, 2]; clamp similarity into [0, 1].
  return Math.min(1, Math.max(0, 1 - row.distance));
}

function toCitation(row: CommitSearchResult): ChatCitation {
  return {
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    author: row.author ?? null,
    committedAt: row.committedAt.toISOString(),
    filesChanged: row.metadata?.filesChanged ?? [],
    commitUrl: row.metadata?.commitUrl ?? null,
  };
}

export async function retrieveCommits(opts: {
  projectId: string;
  query: string;
  limit?: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ChatCitation[]> {
  const limit = opts.limit ?? RETRIEVAL_LIMIT;
  const embeddedCount = await commitChunksStore.countChunksForProject({
    projectId: opts.projectId,
    branch: opts.branch,
    embeddedOnly: true,
  });

  let rows: (CommitSearchResult & { _similarity?: number })[] | null = null;
  if (embeddedCount > 0) {
    try {
      const [embedding] = await embedTexts([opts.query]);
      rows = await commitChunksStore.semanticSearchCommits({
        projectId: opts.projectId,
        embedding,
        limit: CANDIDATE_POOL,
        branch: opts.branch,
        startDate: opts.startDate,
        endDate: opts.endDate,
      });
    } catch {
      rows = null;
    }
  }

  if (!rows || rows.length === 0) {
    rows = await commitChunksStore.keywordSearchCommits({
      projectId: opts.projectId,
      query: opts.query,
      limit: CANDIDATE_POOL,
      branch: opts.branch,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });
  }

  if (!rows || rows.length === 0) return [];

  const hasWindow = Boolean(opts.startDate || opts.endDate);
  const threshold = hasWindow ? WINDOWED_MIN_SIMILARITY : MIN_SIMILARITY;

  const scored = rows
    .map((row, i) => {
      const similarity = similarityOf(row, i);
      return { row, similarity, score: importanceScore(row, similarity) };
    })
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter(
    (s) => s.row.distance == null || s.similarity >= threshold,
  );
  // Date-scoped questions always get the window's top commits: when nothing
  // is topically similar enough, importance inside the window wins.
  const picked = relevant.length > 0 ? relevant : hasWindow ? scored : [];

  return picked.slice(0, limit).map((s) => toCitation(s.row));
}