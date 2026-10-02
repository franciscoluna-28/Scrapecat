import { describe, it, expect } from "vitest";
import { createFsArchiveStore } from "./fs-archive-store";

describe("fs archive store", () => {
  it("never hydrates (local disk is already the archive)", async () => {
    const store = createFsArchiveStore();
    expect(await store.hydrate({ owner: "o", repo: "r", branch: "main" }, "/does/not/matter")).toBeNull();
  });

  it("dehydrate is a no-op", async () => {
    const store = createFsArchiveStore();
    await expect(
      store.dehydrate("/does/not/matter", { owner: "o", repo: "r", branch: "main" }, "tip"),
    ).resolves.toBeUndefined();
  });
});
