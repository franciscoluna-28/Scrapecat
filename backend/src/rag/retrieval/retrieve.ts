import type { ChatCitation } from "@/db/schema";
import {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_COSINE_DISTANCE,
  MAX_RETRIEVAL_LIMIT,
  TEMPORAL_CONTEXT_LIMIT,
} from "@/rag/constants";
import {
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
  commitEmbeddingsStore,
  type CommitDocument,
} from "@/rag/indexing/commit-embeddings-store";

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
  store: typeof commitEmbeddingsStore;
};

const defaultDeps: RetrieverDeps = {
  embed: embedTexts,
  resolveSpace: resolveEmbeddingSpace,
  store: commitEmbeddingsStore,
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

function toCitation(row: CommitDocument): ChatCitation {
  return {
    commitSha: row.commitSha,
    commitMessage: row.message,
    summary: row.summary ?? undefined,
    author: row.author ?? null,
    committedAt: row.committedAt.toISOString(),
    filesChanged: row.filesChanged,
    commitUrl: row.commitUrl || null,
  };
}

/**
 * Retrieval is intentionally small: lexical + semantic candidates, one cosine
 * ceiling, RRF, and a temporal window route. No corroboration layer.
 */
export function createRetriever(overrides: Partial<RetrieverDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

  async function temporalRetrieve(opts: {
    projectId: string;
    branch?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<RetrievalResult> {
    const rows = await deps.store.listCommitsInWindow({
      repoId: opts.projectId,
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
    if ((opts.startDate || opts.endDate) && isTemporalSummaryQuery(opts.query)) {
      return temporalRetrieve(opts);
    }

    const limit = Math.min(
      opts.limit ?? DEFAULT_RETRIEVAL_LIMIT,
      MAX_RETRIEVAL_LIMIT,
    );
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
        embeddedCount = await deps.store.countCommitsForProject({
          repoId: opts.projectId,
          branch: opts.branch,
        });
      } catch {
        embeddedCount = 0;
      }
    }

    const lexical = deps.store.lexicalSearchCommits({
      repoId: opts.projectId,
      query: opts.query,
      limit: candidateLimit,
      branch: opts.branch,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });

    const semantic =
      activeSpace && embeddedCount > 0
        ? (async () => {
            const [embedding] = await deps.embed([opts.query], activeSpace);
            return deps.store.semanticSearchCommits({
              repoId: opts.projectId,
              embedding,
              embeddingSpace: activeSpace,
              limit: candidateLimit,
              branch: opts.branch,
              startDate: opts.startDate,
              endDate: opts.endDate,
            });
          })()
        : Promise.resolve<CommitDocument[]>([]);

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

    if (lexicalRows.length === 0 && semanticHits.length === 0) {
      return {
        citations: [],
        trace: {
          ...emptyTrace("hybrid"),
          abstained: true,
          semanticCandidates: semanticRows.length,
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
    const result = await retrieveDetailed({
      projectId: opts.projectId,
      query: parsed.filteredQuery,
      branch: opts.branch,
      limit: opts.limit,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    });

    return {
      ...result,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    };
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
