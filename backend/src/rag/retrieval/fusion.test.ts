import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "@/rag/retrieval/fusion";

const id = (value: string) => value;

describe("reciprocalRankFusion", () => {
  it("ranks items that agree across lists first", () => {
    const fused = reciprocalRankFusion(
      [
        { items: ["a", "b"] },
        { items: ["b", "c"] },
      ],
      id,
    );

    expect(fused).toEqual(["b", "a", "c"]);
  });

  it("dedupes items across lists", () => {
    const fused = reciprocalRankFusion(
      [{ items: ["a"] }, { items: ["a"] }],
      id,
    );

    expect(fused).toEqual(["a"]);
  });

  it("returns an empty list when every channel is empty", () => {
    expect(reciprocalRankFusion([{ items: [] }, { items: [] }], id)).toEqual([]);
  });

  it("supports weighted channels", () => {
    const fused = reciprocalRankFusion(
      [
        { items: ["lexical"], weight: 2 },
        { items: ["semantic"], weight: 1 },
      ],
      id,
    );

    expect(fused).toEqual(["lexical", "semantic"]);
  });
});
