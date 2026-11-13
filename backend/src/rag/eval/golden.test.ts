import { describe, expect, it } from "vitest";
import { parseGoldenDataset } from "@/rag/eval/golden";

const base = {
  version: 1,
  name: "test",
  project: {
    gitProvider: "github",
    providerOwner: "owner",
    repositoryName: "repo",
    branch: "main",
  },
  cases: [
    {
      id: "one",
      query: "what changed?",
      category: "semantic",
      relevantShas: ["abc"],
    },
  ],
};

describe("parseGoldenDataset", () => {
  it("accepts a valid dataset", () => {
    const dataset = parseGoldenDataset(base);

    expect(dataset.name).toBe("test");
    expect(dataset.cases).toHaveLength(1);
  });

  it("rejects duplicate case ids", () => {
    const dataset = {
      ...base,
      cases: [base.cases[0], { ...base.cases[0] }],
    };

    expect(() => parseGoldenDataset(dataset)).toThrow(/duplicate case id/);
  });

  it("requires relevant SHAs for non-negative cases", () => {
    const dataset = {
      ...base,
      cases: [{ ...base.cases[0], relevantShas: [] }],
    };

    expect(() => parseGoldenDataset(dataset)).toThrow(/must list at least one/);
  });

  it("rejects relevant SHAs on negative cases", () => {
    const dataset = {
      ...base,
      cases: [{ ...base.cases[0], category: "negative" }],
    };

    expect(() => parseGoldenDataset(dataset)).toThrow(
      /negative cases must not list/,
    );
  });
});
