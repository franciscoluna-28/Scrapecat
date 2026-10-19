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
