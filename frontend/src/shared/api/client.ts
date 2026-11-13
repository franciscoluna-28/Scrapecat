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

type ApiErrorOptions = {
  status?: number;
  requestId?: string;
};

/** Normalized failure for every API call, including network and stream errors. */
export class ApiError extends Error {
  readonly status?: number;
  readonly requestId?: string;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

function messageFromBody(body: unknown): string | null {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return null;
}

function requestIdFrom(response?: Response): string | undefined {
  return response?.headers.get("x-request-id") ?? undefined;
}

/** Converts a parsed error body or thrown error into a normalized `ApiError`. */
export function toApiError(error: unknown, response?: Response): ApiError {
  if (error instanceof ApiError) return error;
  const message =
    messageFromBody(error) ??
    (error instanceof Error && error.message ? error.message : "Request failed");
  return new ApiError(message, {
    status: response?.status,
    requestId: requestIdFrom(response),
  });
}

/** Reads the `{ error }` contract from a non-OK response. */
export async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  let message: string | null = null;
  try {
    message = messageFromBody(await res.json());
  } catch {
    // Non-JSON body; fall back to the status code below.
  }
  return new ApiError(message ?? `Request failed: ${res.status}`, {
    status: res.status,
    requestId: requestIdFrom(res),
  });
}

/** Message to show in a toast or inline error slot. */
export function errorMessage(error: unknown, fallback = "Request failed"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

type ApiResult<T> = {
  data?: T;
  error?: unknown;
  response?: Response;
};

/**
 * Unwraps an `openapi-fetch` result: throws a normalized `ApiError` on
 * transport/API failure, returns `data` typed from the generated spec.
 */
export async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
  let result: ApiResult<T>;
  try {
    result = await request;
  } catch (error) {
    throw toApiError(error);
  }
  if (result.error) throw toApiError(result.error, result.response);
  return result.data as T;
}
