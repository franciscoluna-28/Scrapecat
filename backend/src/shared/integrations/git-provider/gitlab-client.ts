import { env } from "@/config/env";

/**
 * Single GitLab HTTP construction point (auth + timeout + retry), mirroring
 * `octokit.ts` for GitHub. The discovery surface is small enough that a thin
 * `fetch` wrapper beats pulling in a full GitLab SDK: we get retry/backoff
 * (which @gitbeaker/rest does not provide) and only the endpoints we use.
 *
 * Tokens are sent as `PRIVATE-TOKEN`, the documented header for personal,
 * project, and group access tokens.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const MAX_PAGES = 20;
const PER_PAGE = 100;

export class GitlabApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitlabApiError";
    this.status = status;
  }
}

/**
 * Accepts `gitlab.com`, `https://gitlab.com/`, or a self-hosted instance URL.
 * Missing schemes default to HTTPS; trailing slashes are dropped.
 */
export function normalizeGitlabHost(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, "");
  if (!trimmed) return "https://gitlab.com";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

type QueryValue = string | number | boolean | undefined;

export type GitlabResponse<T> = {
  data: T;
  headers: Headers;
};

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const { message } = body as { message?: unknown };
    if (typeof message === "string") return message;
    if (message && typeof message === "object") {
      return Object.entries(message as Record<string, unknown>)
        .map(([field, value]) =>
          Array.isArray(value) ? `${field}: ${value.join(", ")}` : `${field}: ${String(value)}`,
        )
        .join("; ");
    }
  }
  return `GitLab request failed with status ${status}`;
}

/** `Retry-After` (seconds) first, then `RateLimit-Reset` (epoch), then backoff. */
function retryDelayMs(headers: Headers, attempt: number): number {
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;

  const reset = Number(headers.get("ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    const wait = reset * 1000 - Date.now();
    if (wait > 0) return Math.min(wait, 10_000);
  }

  return Math.min(500 * 2 ** attempt, 5_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGitlabClient(
  token: string | null = null,
  host: string = env.GITLAB_HOST,
) {
  const normalizedHost = normalizeGitlabHost(host);
  const baseUrl = `${normalizedHost}/api/v4`;

  async function request<T>(
    path: string,
    options: { query?: Record<string, QueryValue> } = {},
  ): Promise<GitlabResponse<T>> {
    const url = buildUrl(baseUrl, path, options.query);

    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { "PRIVATE-TOKEN": token } : {}),
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (response.ok) {
        const text = await response.text();
        return {
          data: (text ? JSON.parse(text) : null) as T,
          headers: response.headers,
        };
      }

      const body = await response.json().catch(() => null);
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(retryDelayMs(response.headers, attempt));
        continue;
      }

      throw new GitlabApiError(
        response.status,
        parseErrorMessage(response.status, body),
      );
    }
  }

  /**
   * Offset pagination for list endpoints, bounded by `maxPages` as a safety
   * valve. GitLab reports the next page in `x-next-page` (empty when done).
   */
  async function requestAll<T>(
    path: string,
    options: { query?: Record<string, QueryValue>; maxPages?: number } = {},
  ): Promise<T[]> {
    const maxPages = options.maxPages ?? MAX_PAGES;
    const items: T[] = [];

    for (let page = 1; page > 0 && page <= maxPages; ) {
      const { data, headers } = await request<T[]>(path, {
        query: { ...options.query, page, per_page: PER_PAGE },
      });
      items.push(...data);

      const next = Number(headers.get("x-next-page"));
      page = Number.isFinite(next) ? next : 0;
      if (data.length === 0) break;
    }

    return items;
  }

  return { host: normalizedHost, baseUrl, request, requestAll };
}

export type GitlabClient = ReturnType<typeof createGitlabClient>;
