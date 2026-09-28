import { describe, it, expect } from "vitest";
import { restrictDemoBranches, isDemoBranchAllowed } from "@/shared/demo-branches";

describe("restrictDemoBranches", () => {
  it("keeps only trunk branches", () => {
    expect(restrictDemoBranches(["main", "dev", "master", "feat/x"], "main")).toEqual([
      "main",
      "master",
    ]);
  });

  it("falls back to the default branch when no trunk branch exists", () => {
    expect(restrictDemoBranches(["canary", "dev"], "canary")).toEqual(["canary"]);
  });

  it("keeps main when master is absent", () => {
    expect(restrictDemoBranches(["main", "dev"], "main")).toEqual(["main"]);
  });
});

describe("isDemoBranchAllowed", () => {
  it("allows main, master and the repo default", () => {
    expect(isDemoBranchAllowed("main", "canary")).toBe(true);
    expect(isDemoBranchAllowed("master", "canary")).toBe(true);
    expect(isDemoBranchAllowed("canary", "canary")).toBe(true);
  });

  it("rejects non-trunk branches", () => {
    expect(isDemoBranchAllowed("dev", "main")).toBe(false);
    expect(isDemoBranchAllowed("feat/x", "main")).toBe(false);
  });
});
