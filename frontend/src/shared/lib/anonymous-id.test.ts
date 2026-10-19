import { describe, it, expect, beforeEach } from "vitest";
import { getAnonymousId } from "./anonymous-id";

const COOKIE = "_scrapecat_uid";

describe("getAnonymousId", () => {
  beforeEach(() => {
    document.cookie = `${COOKIE}=; max-age=0; path=/`;
  });

  it("mints and persists a new id when none exists", () => {
    const id = getAnonymousId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(document.cookie).toContain(`${COOKIE}=${encodeURIComponent(id)}`);
  });

  it("returns the same id on subsequent calls", () => {
    expect(getAnonymousId()).toBe(getAnonymousId());
  });

  it("reuses an existing cookie value", () => {
    document.cookie = `${COOKIE}=abc-123; path=/`;
    expect(getAnonymousId()).toBe("abc-123");
  });
});
