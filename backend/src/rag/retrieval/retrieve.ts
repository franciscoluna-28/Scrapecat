import type { ChatCitation } from "@/db/schema";
import {
  hasTemporalIntent,
  isTemporalSummaryQuery,
  parseQueryWindow,
} from "@/rag/retrieval/date-window";
import { reciprocalRankFusionScored } from "@/rag/retrieval/fusion";
import {
  embedTexts,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/rag/indexing/embeddings";
import {
  commitChunksStore,
  type CommitSearchResult,
} from "@/rag/indexing/commit-chunks-store";

export const RETRIEVAL_LIMIT = 20;

/**
 * Accuracy-first cap for window summaries. The temporal channel returns the
 * whole window instead of top-k; the cap only protects the prompt token budget.
 */
export const TEMPORAL_CONTEXT_LIMIT = 200;

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
 */
export const MAX_COSINE_DISTANCE = 0.8;

/**
 * Above this distance a semantic candidate is weak evidence. If the lexical
 * channel also finds nothing, the retriever abstains instead of returning
 * irrelevant context. Tune from eval diagnostics, not intuition.
 */
export const ABSTAIN_COSINE_DISTANCE = 0.7;

export type RetrievalMode = "hybrid" | "temporal";

export type RetrievalTrace = {
  mode: RetrievalMode;
  abstained: boolean;
  lexicalCandidates: number;
  semanticCandidates: number;
  semanticHits: number;
  bestSemanticDistance: number | null;
  fusedCandidates: number;
  topFusedScore: number | null;
  truncated: boolean;
};

export type RetrievalResult = {
  citations: ChatCitation[];
  trace: RetrievalTrace;
};

export type ScopeResult = RetrievalResult & {
  startDate?: Date;
  endDate?: Date;
};

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

function emptyTrace(mode: RetrievalMode): RetrievalTrace {
  return {
    mode,
    abstained: false,
    lexicalCandidates: 0,
    semanticCandidates: 0,
    semanticHits: 0,
    bestSemanticDistance: null,
    fusedCandidates: 0,
    topFusedScore: null,
    truncated: false,
  };
}

/**
 * Retriever stage: semantic and lexical channels fused with RRF, temporal
 * window summaries, and deterministic abstention when neither channel has
 * enough evidence.
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

  async function temporalRetrieve(opts: {
    projectId: string;
    branch?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<RetrievalResult> {
    const rows = await deps.store.listCommitsInWindow({
      projectId: opts.projectId,
      branch: opts.branch,
      startDate: opts.startDate,
      endDate: opts.endDate,
      limit: TEMPORAL_CONTEXT_LIMIT + 1,
    });
    const truncated = rows.length > TEMPORAL_CONTEXT_LIMIT;
    const kept = rows.slice(0, TEMPORAL_CONTEXT_LIMIT);
    return {
      citations: kept.map(toCitation),
      trace: {
        ...emptyTrace("temporal"),
        abstained: kept.length === 0,
        fusedCandidates: kept.length,
        truncated,
      },
    };
  }

  async function retrieveDetailed(opts: {
    projectId: string;
    query: string;
    limit?: number;
    branch?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<RetrievalResult> {
    if (
      (opts.startDate || opts.endDate) &&
      isTemporalSummaryQuery(opts.query)
    ) {
      return temporalRetrieve(opts);
    }

    const limit = opts.limit ?? RETRIEVAL_LIMIT;
    const candidateLimit = Math.min(limit * 4, 200);

    let activeSpace: EmbeddingSpace | null = null;
    try {
      activeSpace = await deps.resolveSpace();
    } catch {
      activeSpace = null;
    }

    let embeddedCount = 0;
    if (activeSpace) {
      try {
        embeddedCount = await deps.store.countChunksForProject({
          projectId: opts.projectId,
          branch: opts.branch,
          embeddingSpace: activeSpace,
        });
      } catch {
        embeddedCount = 0;
      }
    }

    const lexical = deps.store.lexicalSearchCommits({
      projectId: opts.projectId,
      query: opts.query,
      limit: candidateLimit,
      branch: opts.branch,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });

    const semantic =
      activeSpace && embeddedCount > 0
        ? (async () => {
            const [embedding] = await deps.embed(
              [queryText(opts)],
              activeSpace,
            );
            return deps.store.semanticSearchCommits({
              projectId: opts.projectId,
              embedding,
              embeddingSpace: activeSpace,
              limit: candidateLimit,
              branch: opts.branch,
              startDate: opts.startDate,
              endDate: opts.endDate,
            });
          })()
        : Promise.resolve<CommitSearchResult[]>([]);

    const [lexicalResult, semanticResult] = await Promise.allSettled([
      lexical,
      semantic,
    ]);

    const lexicalRows =
      lexicalResult.status === "fulfilled" ? lexicalResult.value : [];
    const semanticRows =
      semanticResult.status === "fulfilled" ? semanticResult.value : [];
    const semanticHits = semanticRows.filter(
      (row) => row.distance == null || row.distance <= MAX_COSINE_DISTANCE,
    );
    const semanticDistances = semanticRows
      .map((row) => row.distance)
      .filter((distance): distance is number => distance != null);
    const bestSemanticDistance = semanticDistances.length
      ? Math.min(...semanticDistances)
      : null;

    const hasLexical = lexicalRows.length > 0;
    const hasSemantic =
      bestSemanticDistance != null &&
      bestSemanticDistance <= ABSTAIN_COSINE_DISTANCE;

    if (!hasLexical && !hasSemantic) {
      return {
        citations: [],
        trace: {
          ...emptyTrace("hybrid"),
          abstained: true,
          lexicalCandidates: 0,
          semanticCandidates: semanticRows.length,
          semanticHits: semanticHits.length,
          bestSemanticDistance,
        },
      };
    }

    const fused = reciprocalRankFusionScored(
      [{ items: lexicalRows }, { items: semanticHits }],
      (row) => row.commitSha,
    );

    return {
      citations: fused.slice(0, limit).map((entry) => toCitation(entry.item)),
      trace: {
        ...emptyTrace("hybrid"),
        lexicalCandidates: lexicalRows.length,
        semanticCandidates: semanticRows.length,
        semanticHits: semanticHits.length,
        bestSemanticDistance,
        fusedCandidates: fused.length,
        topFusedScore: fused[0]?.score ?? null,
      },
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
    return (await retrieveDetailed(opts)).citations;
  }

  async function resolveScopeDetailed(opts: {
    projectId: string;
    query: string;
    branch?: string;
    limit?: number;
  }): Promise<ScopeResult> {
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
      retrieveDetailed({
        projectId: opts.projectId,
        query: parsed.filteredQuery,
        branch: opts.branch,
        limit: opts.limit,
        ...window,
      });

    let result = await retrieveWith({ startDate, endDate });

    if (result.citations.length === 0 && parsed.isRelative) {
      const latest = await deps.latestCommitDate({
        projectId: opts.projectId,
        branch: opts.branch,
      });
      if (latest) {
        startDate = new Date(
          latest.getTime() - RELATIVE_FALLBACK_DAYS * DAY_MS,
        );
        endDate = latest;
        result = await retrieveWith({ startDate, endDate });
      }
    }

    return { ...result, startDate, endDate };
  }

  async function resolveScope(opts: {
    projectId: string;
    query: string;
    branch?: string;
    limit?: number;
  }): Promise<ScopeResult> {
    return resolveScopeDetailed(opts);
  }

  return { retrieve, retrieveDetailed, resolveScope, resolveScopeDetailed };
}

export const retriever = createRetriever();
