import { retriever, type RetrievalTrace } from "@/rag/retrieval/retrieve";
import type { GoldenCase, GoldenDataset } from "@/rag/eval/golden";
import {
  computeMetrics,
  summarizeMetrics,
  type ContextMetrics,
  type ContextMetricsSummary,
} from "@/rag/eval/metrics";
import { resolveEmbeddingSpace } from "@/rag/indexing/embeddings";
import { prepareProjectBranch } from "@/api/repositories/services";
import { commitChunksStore } from "@/rag/indexing/commit-chunks-store";
import { projectsStore } from "@/api/repositories/stores/projects-store";

type ProjectRow = NonNullable<
  Awaited<ReturnType<typeof projectsStore.getProjectByOwnerRepo>>
>;

type PrepareResult = Awaited<ReturnType<typeof prepareProjectBranch>>;

export type EvalRetrieverResult = {
  citations: { commitSha: string }[];
  trace: RetrievalTrace;
};

export type EvalRetriever = {
  resolveScopeDetailed(opts: {
    projectId: string;
    query: string;
    branch?: string;
    limit?: number;
  }): Promise<EvalRetrieverResult>;
  retrieveDetailed(opts: {
    projectId: string;
    query: string;
    branch?: string;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<EvalRetrieverResult>;
};

export type GoldenCaseResult = {
  id: string;
  query: string;
  category: GoldenCase["category"];
  expected: string[];
  retrieved: string[];
  relevantRanks: Record<string, number | null>;
  missingShas: string[];
  trace: RetrievalTrace;
  metrics: ContextMetrics | null;
  passed: boolean;
};

export type EvalReport = {
  dataset: string;
  branch: string;
  topK: number;
  cases: GoldenCaseResult[];
  summary: ContextMetricsSummary;
  negativeAccuracy: number;
};

type EvalServiceDeps = {
  projects: Pick<typeof projectsStore, "getProjectByOwnerRepo" | "upsertProject">;
  chunks: Pick<
    typeof commitChunksStore,
    "getChunksByShas" | "countChunksForProject"
  >;
  prepareBranch: typeof prepareProjectBranch;
  resolveSpace: typeof resolveEmbeddingSpace;
  retriever: EvalRetriever;
};

const defaultDeps: EvalServiceDeps = {
  projects: projectsStore,
  chunks: commitChunksStore,
  prepareBranch: prepareProjectBranch,
  resolveSpace: resolveEmbeddingSpace,
  retriever,
};

export type DatasetCheck = {
  missingShas: string[];
  warnings: string[];
};

export type EvalServiceResult = {
  projectId: string;
  prepared?: PrepareResult;
  check: DatasetCheck;
  report: EvalReport;
};

function parseWindowDate(value: string, caseId: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`case "${caseId}" has an invalid window date: ${value}`);
  }
  return date;
}

/**
 * Golden-set evaluation: resolve/ingest the dataset project, validate its
 * labels against the read model, score the retriever, and aggregate metrics.
 * CLI concerns (arguments, formatting) stay in the script.
 */
export function createEvalService(overrides: Partial<EvalServiceDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

  async function retrieveForCase(input: {
    projectId: string;
    branch: string;
    topK: number;
    goldenCase: GoldenCase;
  }): Promise<EvalRetrieverResult> {
    const { projectId, branch, topK, goldenCase } = input;

    if (goldenCase.window) {
      const { startDate, endDate } = goldenCase.window;
      return deps.retriever.retrieveDetailed({
        projectId,
        query: goldenCase.query,
        branch,
        limit: topK,
        ...(startDate ? { startDate: parseWindowDate(startDate, goldenCase.id) } : {}),
        ...(endDate ? { endDate: parseWindowDate(endDate, goldenCase.id) } : {}),
      });
    }

    // No explicit window: same path as production chat, including query date
    // parsing and the relative-recency fallback.
    return deps.retriever.resolveScopeDetailed({
      projectId,
      query: goldenCase.query,
      branch,
      limit: topK,
    });
  }

  async function scoreDataset(input: {
    dataset: GoldenDataset;
    projectId: string;
    topK: number;
  }): Promise<EvalReport> {
    const { dataset, projectId, topK } = input;
    const branch = dataset.project.branch;
    const cases: GoldenCaseResult[] = [];

    for (const goldenCase of dataset.cases) {
      const { citations, trace } = await retrieveForCase({
        projectId,
        branch,
        topK,
        goldenCase,
      });
      const retrieved = citations.map((citation) => citation.commitSha);
      // A temporal summary returns the whole window, not a top-k slice.
      const scored =
        trace.mode === "temporal" ? retrieved : retrieved.slice(0, topK);
      const effectiveK = trace.mode === "temporal" ? scored.length : topK;

      if (goldenCase.category === "negative") {
        cases.push({
          id: goldenCase.id,
          query: goldenCase.query,
          category: goldenCase.category,
          expected: [],
          retrieved: scored,
          relevantRanks: {},
          missingShas: [],
          trace,
          metrics: null,
          passed: scored.length === 0,
        });
        continue;
      }

      const rankBySha = new Map(scored.map((sha, index) => [sha, index + 1]));
      const metrics = computeMetrics(scored, goldenCase.relevantShas, effectiveK);
      cases.push({
        id: goldenCase.id,
        query: goldenCase.query,
        category: goldenCase.category,
        expected: goldenCase.relevantShas,
        retrieved: scored,
        relevantRanks: Object.fromEntries(
          goldenCase.relevantShas.map((sha) => [sha, rankBySha.get(sha) ?? null]),
        ),
        missingShas: goldenCase.relevantShas.filter((sha) => !rankBySha.has(sha)),
        trace,
        metrics,
        passed: metrics.hit,
      });
    }

    const scoredMetrics = cases
      .map((result) => result.metrics)
      .filter((metrics): metrics is ContextMetrics => metrics !== null);
    const negatives = cases.filter((result) => result.category === "negative");
    const negativeAccuracy =
      negatives.length === 0
        ? 1
        : negatives.filter((result) => result.passed).length / negatives.length;

    return {
      dataset: dataset.name,
      branch,
      topK,
      cases,
      summary: summarizeMetrics(scoredMetrics),
      negativeAccuracy,
    };
  }

  async function resolveProject(
    dataset: GoldenDataset,
    prepare: boolean,
  ): Promise<ProjectRow> {
    const ownerRepo = {
      gitProvider: dataset.project.gitProvider,
      providerOwner: dataset.project.providerOwner,
      repositoryName: dataset.project.repositoryName,
    };
    const existing = await deps.projects.getProjectByOwnerRepo(ownerRepo);
    if (existing) return existing;

    if (!prepare) {
      throw new Error(
        `Project ${dataset.project.providerOwner}/${dataset.project.repositoryName} is not indexed. ` +
          "Run with --prepare to ingest it first.",
      );
    }

    const { project } = await deps.projects.upsertProject({
      gitProvider: dataset.project.gitProvider,
      providerProjectId: `${dataset.project.providerOwner}/${dataset.project.repositoryName}`,
      providerOwner: dataset.project.providerOwner,
      repositoryName: dataset.project.repositoryName,
      defaultBranch: dataset.project.branch,
    });
    return project;
  }

  async function checkDataset(
    dataset: GoldenDataset,
    projectId: string,
  ): Promise<DatasetCheck> {
    const judged = [...new Set(dataset.cases.flatMap((c) => c.relevantShas))];
    const found = await deps.chunks.getChunksByShas({
      projectId,
      shas: judged,
      branch: dataset.project.branch,
    });
    const missingShas = judged.filter((sha) => !found.has(sha));
    if (missingShas.length > 0) {
      throw new Error(
        `${missingShas.length} judged SHA(s) are not indexed for ${dataset.project.branch}: ${missingShas.join(", ")}\n` +
          "Run with --prepare to index the branch first.",
      );
    }

    const warnings: string[] = [];
    try {
      const space = await deps.resolveSpace();
      if (
        dataset.embeddingSpace &&
        (dataset.embeddingSpace.provider !== space.provider ||
          dataset.embeddingSpace.model !== space.model)
      ) {
        warnings.push(
          `Embedding space mismatch: dataset pins ${dataset.embeddingSpace.provider}/${dataset.embeddingSpace.model}, ` +
            `active is ${space.provider}/${space.model}. Metrics are not comparable.`,
        );
      }

      const embedded = await deps.chunks.countChunksForProject({
        projectId,
        branch: dataset.project.branch,
        embeddingSpace: space,
      });
      if (embedded === 0) {
        warnings.push(
          "No embeddings in the active space; the retriever will use its lexical channel only.",
        );
      }
    } catch (error) {
      warnings.push(`Could not check embedding space: ${(error as Error).message}`);
    }

    return { missingShas, warnings };
  }

  async function run(input: {
    dataset: GoldenDataset;
    prepare: boolean;
    topK?: number;
  }): Promise<EvalServiceResult> {
    const { dataset, prepare } = input;
    const project = await resolveProject(dataset, prepare);
    const prepared = prepare
      ? await deps.prepareBranch(project.id, dataset.project.branch)
      : undefined;
    const check = await checkDataset(dataset, project.id);
    const report = await scoreDataset({
      dataset,
      projectId: project.id,
      topK: input.topK ?? 10,
    });

    return { projectId: project.id, prepared, check, report };
  }

  return { resolveProject, checkDataset, run };
}

export const evalService = createEvalService();
