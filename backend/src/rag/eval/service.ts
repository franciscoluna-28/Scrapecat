import { retriever } from "@/rag/retrieval/retrieve";
import type { GoldenCase, GoldenDataset } from "@/rag/eval/golden";
import {
  computeMetrics,
  summarizeMetrics,
  type MetricsSummary,
  type RetrievalMetrics,
} from "@/rag/eval/metrics";
import { resolveEmbeddingSpace } from "@/rag/indexing/embeddings";
import { prepareProjectBranch } from "@/projects/services";
import { commitChunksStore } from "@/rag/indexing/commit-chunks-store";
import { projectsStore } from "@/projects/stores/projects-store";

type ProjectRow = NonNullable<
  Awaited<ReturnType<typeof projectsStore.getProjectById>>
>;

type PrepareResult = Awaited<ReturnType<typeof prepareProjectBranch>>;

export type EvalCitation = { commitSha: string };

export type EvalRetriever = {
  resolveScope(opts: {
    projectId: string;
    query: string;
    branch?: string;
  }): Promise<{ citations: EvalCitation[] }>;
  retrieve(opts: {
    projectId: string;
    query: string;
    branch?: string;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<EvalCitation[]>;
};

export type GoldenCaseResult = {
  id: string;
  query: string;
  category: GoldenCase["category"];
  expected: string[];
  retrieved: string[];
  metrics: RetrievalMetrics | null;
  passed: boolean;
};

export type EvalReport = {
  dataset: string;
  branch: string;
  topK: number;
  cases: GoldenCaseResult[];
  summary: MetricsSummary;
  negativeAccuracy: number;
};

type EvalServiceDeps = {
  projects: Pick<
    typeof projectsStore,
    "getProjectById" | "getProjectByOwnerRepo" | "upsertProject"
  >;
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

function parseWindowDate(value: string, field: string, caseId: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`case "${caseId}" has an invalid ${field}: ${value}`);
  }
  return date;
}

/**
 * Golden-set evaluation: resolve/ingest the dataset project, validate its
 * labels against the read model, score the retriever, and aggregate the
 * metrics. CLI concerns (arguments, formatting) stay in the script.
 */
export function createEvalService(overrides: Partial<EvalServiceDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };

  async function retrieveForCase(input: {
    projectId: string;
    branch: string;
    topK: number;
    goldenCase: GoldenCase;
  }): Promise<string[]> {
    const { projectId, branch, topK, goldenCase } = input;

    if (goldenCase.window) {
      const startDate = goldenCase.window.startDate
        ? parseWindowDate(goldenCase.window.startDate, "startDate", goldenCase.id)
        : undefined;
      const endDate = goldenCase.window.endDate
        ? parseWindowDate(goldenCase.window.endDate, "endDate", goldenCase.id)
        : undefined;

      const citations = await deps.retriever.retrieve({
        projectId,
        query: goldenCase.query,
        branch,
        limit: topK,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });
      return citations.map((citation) => citation.commitSha);
    }

    // No explicit window: use the same path as production chat, including query
    // date parsing and the relative-recency fallback.
    const scope = await deps.retriever.resolveScope({
      projectId,
      query: goldenCase.query,
      branch,
    });
    return scope.citations.map((citation) => citation.commitSha);
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
      const retrieved = await retrieveForCase({
        projectId,
        branch,
        topK,
        goldenCase,
      });
      const topKRetrieved = retrieved.slice(0, topK);

      if (goldenCase.category === "negative") {
        cases.push({
          id: goldenCase.id,
          query: goldenCase.query,
          category: goldenCase.category,
          expected: [],
          retrieved: topKRetrieved,
          metrics: null,
          passed: topKRetrieved.length === 0,
        });
        continue;
      }

      const metrics = computeMetrics(
        topKRetrieved,
        goldenCase.relevantShas,
        topK,
      );
      cases.push({
        id: goldenCase.id,
        query: goldenCase.query,
        category: goldenCase.category,
        expected: goldenCase.relevantShas,
        retrieved: topKRetrieved,
        metrics,
        passed: metrics.hit,
      });
    }

    const scored = cases
      .map((result) => result.metrics)
      .filter((metrics): metrics is RetrievalMetrics => metrics !== null);
    const negative = cases.filter((result) => result.category === "negative");

    return {
      dataset: dataset.name,
      branch,
      topK,
      cases,
      summary: summarizeMetrics(scored),
      negativeAccuracy:
        negative.length === 0
          ? 1
          : negative.filter((result) => result.passed).length / negative.length,
    };
  }

  async function resolveProject(
    dataset: GoldenDataset,
    options: { projectId?: string; prepare: boolean },
  ): Promise<{ project: ProjectRow; prepared?: PrepareResult }> {
    let project: ProjectRow | null = null;

    if (options.projectId) {
      project = await deps.projects.getProjectById(options.projectId);
      if (!project) throw new Error(`Project ${options.projectId} not found`);
    } else {
      project = await deps.projects.getProjectByOwnerRepo({
        gitProvider: dataset.project.gitProvider,
        providerOwner: dataset.project.providerOwner,
        repositoryName: dataset.project.repositoryName,
      });

      if (!project) {
        if (!options.prepare) {
          throw new Error(
            `Project ${dataset.project.providerOwner}/${dataset.project.repositoryName} is not indexed. ` +
              "Run with --prepare to ingest it first.",
          );
        }
        const { project: created } = await deps.projects.upsertProject({
          gitProvider: dataset.project.gitProvider,
          providerProjectId: `${dataset.project.providerOwner}/${dataset.project.repositoryName}`,
          providerOwner: dataset.project.providerOwner,
          repositoryName: dataset.project.repositoryName,
          defaultBranch: dataset.project.branch,
        });
        project = created;
      }
    }

    if (!options.prepare) return { project };

    const prepared = await deps.prepareBranch(project.id, dataset.project.branch);
    return { project, prepared };
  }

  async function checkDataset(
    dataset: GoldenDataset,
    projectId: string,
    options: { allowMissing: boolean },
  ): Promise<DatasetCheck> {
    const judged = [...new Set(dataset.cases.flatMap((c) => c.relevantShas))];
    const found = await deps.chunks.getChunksByShas({
      projectId,
      shas: judged,
      branch: dataset.project.branch,
    });
    const missingShas = judged.filter((sha) => !found.has(sha));
    const warnings: string[] = [];

    if (missingShas.length > 0) {
      const message = `${missingShas.length} judged SHA(s) are not indexed for ${dataset.project.branch}: ${missingShas.join(", ")}`;
      if (!options.allowMissing) {
        throw new Error(`${message}\nRun with --prepare, or pass --allow-missing.`);
      }
      warnings.push(`${message} (continuing because --allow-missing is set)`);
    }

    try {
      const space = await deps.resolveSpace();
      if (
        dataset.embeddingSpace &&
        (dataset.embeddingSpace.provider !== space.provider ||
          dataset.embeddingSpace.model !== space.model)
      ) {
        warnings.push(
          `Embedding space mismatch: dataset pins ${dataset.embeddingSpace.provider}/${dataset.embeddingSpace.model}, ` +
            `active space is ${space.provider}/${space.model}. Metrics will not be comparable.`,
        );
      }

      const embedded = await deps.chunks.countChunksForProject({
        projectId,
        branch: dataset.project.branch,
        embeddingSpace: space,
      });
      if (embedded === 0) {
        warnings.push(
          "No embeddings in the active space; retrieval will use keyword fallback.",
        );
      }
    } catch (error) {
      warnings.push(`Could not check embedding space: ${(error as Error).message}`);
    }

    return { missingShas, warnings };
  }

  async function run(input: {
    dataset: GoldenDataset;
    projectId?: string;
    prepare: boolean;
    allowMissing: boolean;
    topK?: number;
  }): Promise<EvalServiceResult> {
    const { dataset } = input;
    const { project, prepared } = await resolveProject(dataset, input);
    const check = await checkDataset(dataset, project.id, {
      allowMissing: input.allowMissing,
    });

    if (prepared && prepared.branch !== dataset.project.branch) {
      check.warnings.push(
        `Prepared branch ${prepared.branch} differs from dataset branch ${dataset.project.branch}.`,
      );
    }

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
