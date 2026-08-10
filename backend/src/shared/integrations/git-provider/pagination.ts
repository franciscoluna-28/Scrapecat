import type { Page } from "@/shared/integrations/git-provider/types";

export type FetchPage<T> = (page: number) => Promise<Page<T>>;

export interface PaginateOptions<T> {
  /** Page size used by the fetchPage callback; informational only (the driver does not enforce it). */
  pageSize?: number;
  /** Hard cap on the number of pages fetched. 0 = unlimited. */
  maxPages?: number;
  /** Hard cap on the number of items collected. 0 = unlimited. */
  maxCommits?: number;
  /** Absolute deadline for the whole pagination run in ms. 0 = no deadline. */
  deadlineMs?: number;
  /** Called with each raw page (before dedupe) so callers can stop early, e.g. on a watermark. */
  stopWhen?: (items: T[]) => boolean;
  /** Called after each raw page is fetched. */
  onPage?: (pageNumber: number, items: T[]) => void;
  /** Returns a stable identity for an item so duplicates across page boundaries are dropped. */
  dedupeKey?: (item: T) => string;
}

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (status == null) return true;
  const code = Number(status);
  return code >= 500 || code === 429;
}

async function retryTransient<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransient(error) || attempt >= MAX_RETRIES) throw error;
      lastError = error;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
  }
}

/**
 * Collects every item across a paginated provider list by driving a page
 * primitive (`FetchPage`) until exhaustion or a guard/stop condition.
 *
 * Provider-agnostic: retries transient failures (5xx/429/network) with
 * backoff, fails fast on permanent errors, dedupes across page boundaries
 * (lists can shift as new items land), and honors early-stop predicates.
 */
export async function paginate<T>(
  fetchPage: FetchPage<T>,
  opts: PaginateOptions<T> = {},
): Promise<T[]> {
  const maxPages = opts.maxPages ?? 0;
  const maxCommits = opts.maxCommits ?? 0;
  const deadline = opts.deadlineMs ? Date.now() + opts.deadlineMs : undefined;
  const results: T[] = [];
  const seen = new Set<string>();

  let page = 1;
  for (;;) {
    if (maxPages > 0 && page > maxPages) break;
    if (deadline && Date.now() > deadline) break;

    const result = await retryTransient(() => fetchPage(page));
    const items = result.items;

    opts.onPage?.(page, items);

    for (const item of items) {
      const key = opts.dedupeKey?.(item);
      if (key !== undefined) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      results.push(item);
    }

    // The boundary page is processed first, then we stop.
    if (opts.stopWhen?.(items)) break;

    if (!result.hasMore || items.length === 0) break;
    if (maxCommits > 0 && results.length >= maxCommits) break;

    page = result.nextPage != null ? result.nextPage : page + 1;
  }

  if (maxCommits > 0 && results.length > maxCommits) {
    return results.slice(0, maxCommits);
  }
  return results;
}
