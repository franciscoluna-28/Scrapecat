import createClient from "openapi-fetch";
import type { paths } from "./types";
import { getAnonymousId } from "@/src/shared/lib/anonymous-id";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const apiClient = createClient<paths>({
  baseUrl: API_URL,
  headers: {
    get "x-anonymous-id"() {
      return getAnonymousId();
    },
  },
});

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res.json();
}
