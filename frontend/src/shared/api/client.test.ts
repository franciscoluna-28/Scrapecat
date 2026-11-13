import { describe, expect, it } from "vitest";
import {
  ApiError,
  apiErrorFromResponse,
  errorMessage,
  toApiError,
  unwrap,
} from "./client";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("unwrap", () => {
  it("returns typed data on success", async () => {
    const data = { id: "1" };
    await expect(
      unwrap(Promise.resolve({ data, response: jsonResponse(200, data) })),
    ).resolves.toEqual(data);
  });

  it("throws an ApiError with status and request id from the response", async () => {
    const response = jsonResponse(
      400,
      { error: "Invalid request" },
      { "x-request-id": "req-1" },
    );

    const error = await unwrap<unknown>(
      Promise.resolve({ error: { error: "Invalid request" }, response }),
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "Invalid request",
      status: 400,
      requestId: "req-1",
    });
  });

  it("normalizes network failures thrown by fetch", async () => {
    const error = await unwrap(Promise.reject(new TypeError("Failed to fetch"))).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Failed to fetch" });
  });

  it("falls back to the error instance message for non-contract bodies", async () => {
    const error = await unwrap(
      Promise.resolve({ error: new Error("boom"), response: jsonResponse(500, {}) }),
    ).catch((err: unknown) => err);

    expect(error).toMatchObject({ message: "boom", status: 500 });
  });
});

describe("apiErrorFromResponse", () => {
  it("reads the server error message and request id", async () => {
    const response = jsonResponse(
      404,
      { error: "Not found" },
      { "x-request-id": "req-2" },
    );

    await expect(apiErrorFromResponse(response)).resolves.toMatchObject({
      message: "Not found",
      status: 404,
      requestId: "req-2",
    });
  });

  it("falls back to the status code for non-JSON bodies", async () => {
    const error = await apiErrorFromResponse(new Response("bad gateway", { status: 502 }));

    expect(error).toMatchObject({ message: "Request failed: 502", status: 502 });
  });
});

describe("toApiError", () => {
  it("passes through an existing ApiError", () => {
    const original = new ApiError("already normalized");
    expect(toApiError(original)).toBe(original);
  });
});

describe("errorMessage", () => {
  it("uses the normalized or thrown message", () => {
    expect(errorMessage(new ApiError("api failed"))).toBe("api failed");
    expect(errorMessage(new Error("plain failed"))).toBe("plain failed");
    expect(errorMessage("unknown", "fallback")).toBe("fallback");
    expect(errorMessage(null, "fallback")).toBe("fallback");
  });
});
