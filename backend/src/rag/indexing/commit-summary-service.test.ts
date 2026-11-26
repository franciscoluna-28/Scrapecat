import { describe, expect, it, vi } from "vitest";
import {
  createCommitSummaryService,
  COMMIT_SUMMARY_VERSION,
} from "@/rag/indexing/commit-summary-service";
import type { CommitDiff } from "@/rag/git/commit-diff";
import type { SourceCommit } from "@/rag/indexing/source";

const commit: SourceCommit = {
  sha: "abc123",
  message: "feat: lol",
  author: "dev",
  date: "2026-01-01T00:00:00Z",
  parentSha: null,
};

const diff: CommitDiff = {
  stat: "src/auth/session.ts | +10 -5",
  patch:
    "diff --git a/src/auth/session.ts b/src/auth/session.ts\n@@ -1 +1 @@\n-old\n+new",
  filesChanged: ["src/auth/session.ts"],
  additions: 10,
  deletions: 5,
  binaryFiles: 0,
  truncated: false,
  hash: "diff-hash",
};

const model = {
  provider: "openrouter",
  model: { id: "test/summarizer" },
} as never;

function makeService(overrides: {
  status?: "confirmed" | "flagged" | "skipped";
  generate?: ReturnType<typeof vi.fn>;
} = {}) {
  const generate = overrides.generate ?? vi.fn().mockResolvedValue({
    content: "Centralizes auth session validation.",
    finishReason: "stop",
  });
  const service = createCommitSummaryService({
    resolveModel: vi.fn(async () => model),
    ai: { generate } as never,
    classify: vi.fn(() => ({
      status: overrides.status ?? "confirmed",
      notes: [],
    })),
  });
  return { service, generate };
}

describe("commit summary service", () => {
  it("omits a flagged message and summarizes from the diff", async () => {
    const { service, generate } = makeService({ status: "flagged" });

    const result = await service.summarize({ commit, diff, model });

    expect(result.summary).toBe("Centralizes auth session validation.");
    expect(result.model).toBe("test/summarizer");
    expect(result.messageTrusted).toBe(false);

    const userMessage = generate.mock.calls[0][0].messages[1].content as string;
    expect(userMessage).toContain("unavailable or unreliable");
    expect(userMessage).not.toContain("feat: lol");
    expect(userMessage).toContain(diff.patch);
  });

  it("includes a confirmed message as an optional hint", async () => {
    const { service, generate } = makeService({ status: "confirmed" });

    await service.summarize({ commit, diff, model });

    const userMessage = generate.mock.calls[0][0].messages[1].content as string;
    expect(userMessage).toContain("optional hint");
    expect(userMessage).toContain("feat: lol");
    expect(userMessage).toContain("the diff wins");
  });

  it("falls back to a structural summary when the model fails", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("provider down"));
    const { service } = makeService({ generate });

    const result = await service.summarize({ commit, diff, model });

    expect(result.model).toBe("fallback");
    expect(result.summary).toContain("src/auth/session.ts");
    expect(result.summary).toContain("+10/-5");
  });

  it("exposes the summary version", () => {
    expect(COMMIT_SUMMARY_VERSION).toBe("v1");
  });
});
