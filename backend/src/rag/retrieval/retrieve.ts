import type { ChatCitation } from "@/db/schema";
import {
  ABSTAIN_COSINE_DISTANCE,
  CORROBORATION_COSINE_DISTANCE,
  CORROBORATION_TOP_CANDIDATES,
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_COSINE_DISTANCE,
  MIN_QUERY_TOKEN_MATCHES,
  RELATIVE_FALLBACK_DAYS,
  STRONG_COSINE_DISTANCE,
  TEMPORAL_CONTEXT_LIMIT,
} from "@/rag/constants";
import {
  hasTemporalIntent,
  isTemporalSummaryQuery,
  parseQueryWindow,
} from "@/rag/retrieval/date-window";
import { reciprocalRankFusionScored } from "@/rag/retrieval/fusion";
import { countQueryTokenMatches } from "@/rag/retrieval/query-evidence";
import {
  embedTexts,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/rag/indexing/embeddings";
import {
  commitChunksStore,
  type CommitSearchResult,
} from "@/rag/indexing/commit-chunks-store";

const DAY_MS = 86_400_000;

export type RetrievalMode = "hybrid" | "temporal";

export type RetrievalTrace = {
  mode: RetrievalMode;
  abstained: boolean;
  lexicalCandidates: number;
  semanticCandidates: number;
  semanticHits: number;
  bestSemanticDistance: number | null;
  matchedQueryTokens: string[];
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
    matchedQueryTokens: [],
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

    const limit = opts.limit ?? DEFAULT_RETRIEVAL_LIMIT;
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
    const hasStrongSemantic =
      bestSemanticDistance != null &&
      bestSemanticDistance <= STRONG_COSINE_DISTANCE;
    const hasModerateSemantic =
      bestSemanticDistance != null &&
      bestSemanticDistance <= ABSTAIN_COSINE_DISTANCE;
    const queryTokenMatches = countQueryTokenMatches(
      opts.query,
      semanticRows
        .slice(0, CORROBORATION_TOP_CANDIDATES)
        .map((row) => row.commitMessage),
    );
    const hasCorroboratedSemantic =
      bestSemanticDistance != null &&
      bestSemanticDistance <= CORROBORATION_COSINE_DISTANCE &&
      queryTokenMatches.count >= MIN_QUERY_TOKEN_MATCHES;
    // A single channel is not enough for moderate evidence: require lexical
    // corroboration (full match or the query's own tokens in the nearest
    // commits) so out-of-domain questions abstain instead of surfacing the
    // nearest commits.
    const hasSemantic =
      hasStrongSemantic ||
      (hasModerateSemantic && (hasLexical || hasCorroboratedSemantic));

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
          matchedQueryTokens: queryTokenMatches.matched,
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
        matchedQueryTokens: queryTokenMatches.matched,
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
