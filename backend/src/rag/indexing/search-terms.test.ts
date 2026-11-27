import { describe, expect, it } from "vitest";
import { lexicalSearchTerms } from "@/rag/indexing/search-terms";

describe("lexicalSearchTerms", () => {
  it("keeps content terms and drops question scaffolding", () => {
    expect(lexicalSearchTerms("How does the load testing CLI work?")).toEqual([
      "load",
      "testing",
      "cli",
      "work",
    ]);
  });

  it("keeps short identifiers and dedupes", () => {
    expect(lexicalSearchTerms("k6 k6 openapi openapi")).toEqual([
      "k6",
      "openapi",
    ]);
  });

  it("returns an empty list when there is nothing searchable", () => {
    expect(lexicalSearchTerms("how does the")).toEqual([]);
  });
});
