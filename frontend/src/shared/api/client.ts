import createClient from "openapi-fetch";
import type { paths } from "./types";
import { getAnonymousId } from "@/src/shared/lib/anonymous-id";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export const apiClient = createClient<paths>({
  baseUrl: API_URL,
  headers: {
    get "x-anonymous-id"() {
      return getAnonymousId();
    },
  },
});

/** Auth headers for raw `fetch` calls that cannot go through `apiClient`. */
export function authHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has("x-anonymous-id")) {
    headers.set("x-anonymous-id", getAnonymousId());
  }
  return headers;
}

/**
 * Best-effort error text from a non-OK response. The backend returns
 * `{ error: string }` for all API failures; fall back to the status code when
 * the body is missing or not JSON.
 */
export async function errorMessageFromResponse(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Non-JSON body; handled by the fallback below.
  }
  return `Request failed: ${res.status}`;
}

/**
 * Unwraps an `openapi-fetch` result: throws on `error`, returns `data` (typed
 * from the generated spec). Keeps the error-first pattern in one place so
 * callers don't repeat `if (result.error) throw result.error`.
 */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown }>,
): Promise<T> {
  const { data, error } = await request;
  if (error) throw error;
  return data as T;
}
