import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGoldenDataset } from "@/eval/golden";

describe("committed golden datasets", () => {
  it("parses the scrapecat-dev dataset", async () => {
    const dataset = await loadGoldenDataset(
      path.resolve(process.cwd(), "eval/datasets/scrapecat-dev.json"),
    );

    expect(dataset.name).toBe("scrapecat-dev");
    expect(dataset.cases.length).toBeGreaterThan(0);
  });
});
