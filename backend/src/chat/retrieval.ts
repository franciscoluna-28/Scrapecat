import type { ChatCitation } from "@/db/schema";
import { hasTemporalIntent, parseQueryWindow } from "@/chat/date-window";
import {
  embedTexts,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/projects/embeddings";
import {
  commitChunksStore,
  type CommitSearchResult,
} from "@/projects/stores/commit-chunks-store";

export const RETRIEVAL_LIMIT = 20;

/**
 * How far back to look when a relative query ("latest", "this week") returns
 * nothing. Anchoring to the newest commit keeps recency questions useful for
 * repos that have not been touched recently.
 */
export const RELATIVE_FALLBACK_DAYS = 45;

const DAY_MS = 86_400_000;

/**
 * Cosine distance ceiling for a semantic hit. `text-embedding-3-small` distances
 * between a natural-language question and short commit subjects typically land
 * around 0.45–0.65 even when the commits are clearly on-topic, so a tight floor
 * throws away the whole candidate set (the model then reports "no commits").
 * Keep this generous: it only drops clearly-unrelated rows and lets the prompt
 * do the quality filtering.
 */
export const MAX_COSINE_DISTANCE = 0.8;

type RetrieverDeps = {
  embed: typeof embedTexts;
  resolveSpace: typeof resolveEmbeddingSpace;
  store: typeof commitChunksStore;
  latestCommitDate: typeof commitChunksStore.getLatestCommitDate;
};

const defaultDeps: RetrieverDeps = {
  embed: embedTexts,
  resolveSpace: resolveEmbeddingSpace,
  store: commitChunksStore,
  latestCommitDate: commitChunksStore.getLatestCommitDate,
};

/**
 * RAG retrieval stage: semantic search with a keyword fallback, plus the
 * temporal window/recency handling for a chat turn.
 */
export function createRetriever(overrides: Partial<RetrieverDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

  function fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  function queryText(opts: {
    query: string;
    startDate?: Date;
    endDate?: Date;
  }): string {
    // Stored embeddings are "YYYY-MM-DD <message>". Only prepend a date
    // when the caller explicitly set a window — that date is derived from
    // actual commits so it aligns. Unscoped queries (e.g. "last feature")
    // embed raw text so the vector match is purely topical.
    const date = opts.endDate ?? opts.startDate;
    return date ? `${fmtDate(date)} ${opts.query}` : opts.query;
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

  async function retrieve(opts: {
    projectId: string;
    query: string;
    limit?: number;
    branch?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ChatCitation[]> {
    const limit = opts.limit ?? RETRIEVAL_LIMIT;
    let space: EmbeddingSpace | null = null;
    try {
      space = await deps.resolveSpace();
    } catch {
      space = null;
    }

    const embeddedCount = space
      ? await deps.store.countChunksForProject({
          projectId: opts.projectId,
          branch: opts.branch,
          embeddingSpace: space,
        })
      : 0;

    let rows: CommitSearchResult[] | null = null;
    if (space && embeddedCount > 0) {
      try {
        const [embedding] = await deps.embed([queryText(opts)], space);
        rows = await deps.store.semanticSearchCommits({
          projectId: opts.projectId,
          embedding,
          embeddingSpace: space,
          limit,
          branch: opts.branch,
          startDate: opts.startDate,
          endDate: opts.endDate,
        });
      } catch {
        rows = null;
      }
    }

    if (!rows || rows.length === 0) {
      rows = await deps.store.keywordSearchCommits({
        projectId: opts.projectId,
        query: opts.query,
        limit: 10,
        branch: opts.branch,
        startDate: opts.startDate,
        endDate: opts.endDate,
      });
    }

    return rows
      .filter((r) => r.distance == null || r.distance <= MAX_COSINE_DISTANCE)
      .map(toCitation);
  }

  async function resolveScope(opts: {
    projectId: string;
    query: string;
    branch?: string;
  }): Promise<{
    citations: ChatCitation[];
    startDate?: Date;
    endDate?: Date;
  }> {
    const parsed = parseQueryWindow(opts.query);
    let startDate = parsed.startDate;
    let endDate = parsed.endDate;

    if (!startDate && !endDate && hasTemporalIntent(opts.query)) {
      const latest = await deps.latestCommitDate({
        projectId: opts.projectId,
        branch: opts.branch,
      });
      if (latest) {
        endDate = latest;
        startDate = new Date(
          latest.getTime() - RELATIVE_FALLBACK_DAYS * DAY_MS,
        );
      }
    }

    const retrieveWith = (window: { startDate?: Date; endDate?: Date }) =>
      retrieve({
        projectId: opts.projectId,
        query: parsed.filteredQuery,
        branch: opts.branch,
        ...window,
      });

    let citations = await retrieveWith({ startDate, endDate });

    if (citations.length === 0 && parsed.isRelative) {
      const latest = await deps.latestCommitDate({
        projectId: opts.projectId,
        branch: opts.branch,
      });
      if (latest) {
        citations = await retrieveWith({
          startDate: new Date(
            latest.getTime() - RELATIVE_FALLBACK_DAYS * DAY_MS,
          ),
          endDate: latest,
        });
      }
    }

    return { citations, startDate, endDate };
  }

  return { retrieve, resolveScope };
}

export const retriever = createRetriever();
