import { describe, expect, it, vi } from "vitest";
import { paginate, type FetchPage } from "@/shared/integrations/git-provider/pagination";

function pageOf<T>(items: T[], nextPage: number | null): { items: T[]; hasMore: boolean; nextPage: number | null } {
  return { items, hasMore: nextPage != null, nextPage };
}

describe("paginate", () => {
  it("collects every item across pages until exhausted", async () => {
    const fetchPage: FetchPage<number> = vi.fn(async (page) =>
      pageOf([page * 10, page * 10 + 1], page < 3 ? page + 1 : null),
    );

    const result = await paginate(fetchPage, {});

    expect(result).toEqual([10, 11, 20, 21, 30, 31]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("honors maxCommits", async () => {
    const fetchPage: FetchPage<number> = vi.fn(async (page) =>
      pageOf(
        [(page - 1) * 3 + 1, (page - 1) * 3 + 2, (page - 1) * 3 + 3],
        page + 1,
      ),
    );

    const result = await paginate(fetchPage, { maxCommits: 5 });

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("honors maxPages", async () => {
    const fetchPage: FetchPage<number> = vi.fn(async (page) =>
      pageOf([page], page + 1),
    );

    const result = await paginate(fetchPage, { maxPages: 2 });

    expect(result).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops early when stopWhen returns true", async () => {
    const fetchPage: FetchPage<string> = vi.fn(async (page) =>
      pageOf([`c${page}a`, `c${page}b`], page + 1),
    );

    const result = await paginate(fetchPage, {
      stopWhen: (items) => items.some((i) => i === "c2a"),
    });

    expect(result).toEqual(["c1a", "c1b", "c2a", "c2b"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("dedupes items across page boundaries", async () => {
    const fetchPage: FetchPage<{ sha: string }> = vi.fn(async (page) =>
      pageOf([{ sha: "a" }, { sha: "b" }], page === 1 ? 2 : null),
    );

    // Simulate a commit shifting from page 2 to page 1 between requests.
    const result = await paginate(fetchPage, { dedupeKey: (c) => c.sha });

    expect(result).toEqual([{ sha: "a" }, { sha: "b" }]);
  });

  it("stops on an empty page even when hasMore is true", async () => {
    const fetchPage: FetchPage<number> = vi.fn(async (page) => {
      if (page === 1) return pageOf([1, 2], 2);
      return pageOf([], 3);
    });

    const result = await paginate(fetchPage, {});

    expect(result).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("retries transient failures and succeeds", async () => {
    let calls = 0;
    const fetchPage: FetchPage<number> = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network blip");
      return pageOf([1], null);
    });

    const result = await paginate(fetchPage, {});

    expect(result).toEqual([1]);
    expect(calls).toBe(2);
  });

  it("fails fast on permanent errors", async () => {
    const fetchPage: FetchPage<number> = vi.fn(async () => {
      throw Object.assign(new Error("not found"), { status: 404 });
    });

    await expect(paginate(fetchPage, {})).rejects.toThrow("not found");
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
