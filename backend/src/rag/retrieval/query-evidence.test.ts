import { describe, expect, it } from "vitest";
import {
  contentTokens,
  countQueryTokenMatches,
} from "@/rag/retrieval/query-evidence";

describe("contentTokens", () => {
  it("lowercases, strips possessives, and splits on non-alphanumerics", () => {
    expect(contentTokens("Worker's chat, app's routes")).toEqual([
      "worker",
      "chat",
      "app",
      "routes",
    ]);
  });

  it("normalizes curly apostrophes", () => {
    expect(contentTokens("visitor\u2019s session")).toEqual([
      "visitor",
      "session",
    ]);
  });

  it("drops stopwords and tokens shorter than three characters", () => {
    expect(contentTokens("How do we add it to the API?")).toEqual([
      "add",
      "api",
    ]);
    expect(contentTokens("how does the sync work")).toEqual(["sync"]);
  });

  it("drops it's but keeps its (known accepted asymmetry)", () => {
    expect(contentTokens("it's done")).toEqual(["done"]);
    expect(contentTokens("its value")).toEqual(["its", "value"]);
  });

  it("does not stem or prefix-match", () => {
    expect(contentTokens("apps workers")).toEqual(["apps", "workers"]);
  });
});

describe("countQueryTokenMatches", () => {
  it("counts distinct query tokens found across candidate texts", () => {
    const result = countQueryTokenMatches(
      "How do we stop one visitor from reading another visitor's chat?",
      [
        "fix: enforce chat session ownership",
        "fix: stop auto-selecting the first project on chat",
      ],
    );

    expect(result.count).toBe(2);
    expect(result.matched.sort()).toEqual(["chat", "stop"]);
  });

  it("counts a generic token only once", () => {
    const result = countQueryTokenMatches("How does the Salesforce CRM sync work?", [
      "feat: background sync worker",
      "docs: document the sync state tables",
    ]);

    expect(result.count).toBe(1);
    expect(result.matched).toEqual(["sync"]);
  });

  it("does not match plurals against their singular", () => {
    const result = countQueryTokenMatches("What changed in the mobile apps?", [
      "fix: update app metadata",
      "feat: move app routes",
    ]);

    expect(result.count).toBe(0);
  });
});
