import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RETRIEVAL_LIMIT } from "@/chat/retrieval";
import { loadGoldenDataset } from "@/eval/golden";
import { evalService, type EvalReport } from "@/eval/service";

type Options = {
  dataset: string;
  projectId?: string;
  topK: number;
  json: boolean;
  out?: string;
  minRecall?: number;
  prepare: boolean;
  allowMissing: boolean;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATASET = path.resolve(
  SCRIPT_DIR,
  "../eval/datasets/scrapecat-dev.json",
);

function usage(): string {
  return [
    "Usage: pnpm eval [options]",
    "",
    "  --dataset <path>     Golden dataset JSON (default: eval/datasets/scrapecat-dev.json)",
    "  --project-id <uuid>  Evaluate an existing project instead of resolving owner/repo",
    "  --top-k <n>          Results considered per query (default: 10)",
    "  --min-recall <n>     Exit non-zero when mean recall falls below n (0..1)",
    "  --prepare            Ingest + embed the dataset project/branch before running",
    "  --allow-missing      Continue when judged SHAs are not in the database",
    "  --json               Print the report as JSON",
    "  --out <path>         Write the JSON report to a file",
    "  --help               Show this message",
  ].join("\n");
}

function nextValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dataset: DEFAULT_DATASET,
    topK: 10,
    json: false,
    prepare: false,
    allowMissing: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--":
        // pnpm forwards a literal "--" separator; ignore it.
        break;
      case "--dataset":
        options.dataset = path.resolve(process.cwd(), nextValue(argv, i, arg));
        i += 1;
        break;
      case "--project-id":
        options.projectId = nextValue(argv, i, arg);
        i += 1;
        break;
      case "--top-k":
        options.topK = Number(nextValue(argv, i, arg));
        i += 1;
        break;
      case "--min-recall":
        options.minRecall = Number(nextValue(argv, i, arg));
        i += 1;
        break;
      case "--out":
        options.out = path.resolve(process.cwd(), nextValue(argv, i, arg));
        i += 1;
        break;
      case "--prepare":
        options.prepare = true;
        break;
      case "--allow-missing":
        options.allowMissing = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }

  if (!Number.isInteger(options.topK) || options.topK <= 0) {
    throw new Error("--top-k must be a positive integer");
  }
  if (options.topK > RETRIEVAL_LIMIT) {
    throw new Error(`--top-k must be at most ${RETRIEVAL_LIMIT}`);
  }
  if (
    options.minRecall !== undefined &&
    (!Number.isFinite(options.minRecall) ||
      options.minRecall < 0 ||
      options.minRecall > 1)
  ) {
    throw new Error("--min-recall must be a number between 0 and 1");
  }

  return options;
}

function printReport(report: EvalReport) {
  console.log(
    `\nDataset: ${report.dataset} (branch ${report.branch}, k=${report.topK})\n`,
  );
  console.log(
    `${"case".padEnd(30)} ${"category".padEnd(9)} ${"hits".padEnd(8)} ${"rank".padEnd(5)} ${"recall".padEnd(7)} result`,
  );
  for (const result of report.cases) {
    const rank = result.metrics
      ? result.metrics.mrr > 0
        ? String(Math.round(1 / result.metrics.mrr))
        : "-"
      : "-";
    const hits = result.metrics
      ? `${result.metrics.hits}/${result.metrics.relevant}`
      : "-";
    const recall = result.metrics ? result.metrics.recall.toFixed(2) : "-";
    console.log(
      `${result.id.padEnd(30)} ${result.category.padEnd(9)} ${hits.padEnd(8)} ${rank.padEnd(5)} ${recall.padEnd(7)} ${result.passed ? "pass" : "miss"}`,
    );
  }

  const summary = report.summary;
  console.log(
    `\nSummary: hit-rate=${summary.hitRate.toFixed(3)} recall=${summary.meanRecall.toFixed(3)} ` +
      `mrr=${summary.mrr.toFixed(3)} ndcg=${summary.meanNdcg.toFixed(3)} ` +
      `negative=${report.negativeAccuracy.toFixed(3)}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataset = await loadGoldenDataset(options.dataset);

  const result = await evalService.run({
    dataset,
    projectId: options.projectId,
    prepare: options.prepare,
    allowMissing: options.allowMissing,
    topK: options.topK,
  });

  if (result.prepared) {
    console.log(
      `Prepared branch ${result.prepared.branch}: ${result.prepared.commitsFound} commits, ${result.prepared.chunksWritten} written.`,
    );
  }
  for (const warning of result.check.warnings) {
    console.warn(warning);
  }

  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(
      options.out,
      `${JSON.stringify(result.report, null, 2)}\n`,
      "utf8",
    );
    console.log(`Wrote ${options.out}`);
  }

  if (options.json) {
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    printReport(result.report);
  }

  if (
    options.minRecall !== undefined &&
    result.report.summary.meanRecall < options.minRecall
  ) {
    console.error(
      `Mean recall ${result.report.summary.meanRecall.toFixed(3)} is below --min-recall ${options.minRecall}.`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Eval failed: ${(error as Error).message}`);
  process.exit(1);
});
