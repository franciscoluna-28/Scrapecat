import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RETRIEVAL_LIMIT } from "@/rag/retrieval/retrieve";
import { loadGoldenDataset } from "@/rag/eval/golden";
import { evalService, type EvalReport } from "@/rag/eval/service";

type Options = {
  dataset: string;
  topK: number;
  json: boolean;
  prepare: boolean;
  minContextRecall?: number;
  minContextPrecision?: number;
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
    "  --dataset <path>            Golden dataset JSON (default: eval/datasets/scrapecat-dev.json)",
    "  --top-k <n>                 Results considered per query (default: 10)",
    "  --prepare                   Index + embed the dataset project/branch before running",
    "  --min-context-recall <n>    Exit non-zero when mean context recall falls below n (0..1)",
    "  --min-context-precision <n> Exit non-zero when mean context precision falls below n (0..1)",
    "  --json                      Print the full report as JSON (redirect to save)",
    "  --help                      Show this message",
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
      case "--top-k":
        options.topK = Number(nextValue(argv, i, arg));
        i += 1;
        break;
      case "--min-context-recall":
        options.minContextRecall = Number(nextValue(argv, i, arg));
        i += 1;
        break;
      case "--min-context-precision":
        options.minContextPrecision = Number(nextValue(argv, i, arg));
        i += 1;
        break;
      case "--prepare":
        options.prepare = true;
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
  for (const [flag, value] of [
    ["--min-context-recall", options.minContextRecall],
    ["--min-context-precision", options.minContextPrecision],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
      throw new Error(`${flag} must be a number between 0 and 1`);
    }
  }

  return options;
}

function printReport(report: EvalReport) {
  console.log(
    `\nDataset: ${report.dataset} (branch ${report.branch}, k=${report.topK})\n`,
  );
  console.log(
    `${"case".padEnd(30)} ${"category".padEnd(9)} ${"hits".padEnd(7)} ${"rank".padEnd(5)} ${"recall".padEnd(7)} ${"prec".padEnd(6)} result`,
  );
  for (const result of report.cases) {
    const metrics = result.metrics;
    const hits = metrics ? `${metrics.hits}/${metrics.relevant}` : "-";
    const rank =
      metrics && metrics.mrr > 0 ? String(Math.round(1 / metrics.mrr)) : "-";
    const recall = metrics ? metrics.contextRecall.toFixed(2) : "-";
    const precision = metrics ? metrics.contextPrecision.toFixed(2) : "-";
    const missing = result.missingShas.length
      ? ` missing=${result.missingShas.map((sha) => sha.slice(0, 7)).join(",")}`
      : "";
    console.log(
      `${result.id.padEnd(30)} ${result.category.padEnd(9)} ${hits.padEnd(7)} ${rank.padEnd(5)} ${recall.padEnd(7)} ${precision.padEnd(6)} ${result.passed ? "pass" : "miss"}${missing}`,
    );
  }

  const { summary } = report;
  console.log(
    `\nSummary: context-recall=${summary.meanContextRecall.toFixed(3)} ` +
      `context-precision=${summary.meanContextPrecision.toFixed(3)} ` +
      `mrr=${summary.mrr.toFixed(3)} ` +
      `negative-accuracy=${report.negativeAccuracy.toFixed(3)}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataset = await loadGoldenDataset(options.dataset);

  const result = await evalService.run({
    dataset,
    prepare: options.prepare,
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

  if (options.json) {
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    printReport(result.report);
  }

  const gates = [
    {
      flag: "--min-context-recall",
      threshold: options.minContextRecall,
      actual: result.report.summary.meanContextRecall,
      label: "context recall",
    },
    {
      flag: "--min-context-precision",
      threshold: options.minContextPrecision,
      actual: result.report.summary.meanContextPrecision,
      label: "context precision",
    },
  ];
  for (const gate of gates) {
    if (gate.threshold !== undefined && gate.actual < gate.threshold) {
      console.error(
        `Mean ${gate.label} ${gate.actual.toFixed(3)} is below ${gate.flag} ${gate.threshold}.`,
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(`Eval failed: ${(error as Error).message}`);
  process.exit(1);
});
