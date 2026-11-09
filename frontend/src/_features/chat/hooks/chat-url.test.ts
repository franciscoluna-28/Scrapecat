import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isDemo: false }));

vi.mock("@/src/shared/constants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/shared/constants")>();
  return {
    ...actual,
    get IS_DEMO() {
      return mocks.isDemo;
    },
  };
});

import { buildChatUrl, isChatRoute } from "./chat-url";

describe("buildChatUrl", () => {
  it("drops the one-shot q prompt and pins project/session", () => {
    const url = buildChatUrl("/app/chat", "?q=hello&project=old", "p1", "s1");
    expect(url).toBe("/app/chat?project=p1&session=s1");
  });

  it("keeps unrelated params such as branch", () => {
    const url = buildChatUrl("/app/chat", "?branch=dev&q=hello", "p1", "s1");
    expect(url).toBe("/app/chat?branch=dev&project=p1&session=s1");
  });

  it("overwrites stale project/session values", () => {
    const url = buildChatUrl("/app/chat", "?project=old&session=old-session", "p1", "s1");
    expect(url).toBe("/app/chat?project=p1&session=s1");
  });
});

describe("isChatRoute", () => {
  it("matches the canonical chat route in every mode", () => {
    mocks.isDemo = false;
    expect(isChatRoute("/app/chat")).toBe(true);

    mocks.isDemo = true;
    expect(isChatRoute("/app/chat")).toBe(true);
  });

  it("treats the demo home as a chat route", () => {
    mocks.isDemo = true;
    expect(isChatRoute("/app")).toBe(true);
  });

  it("does not treat the home as chat outside demo mode", () => {
    mocks.isDemo = false;
    expect(isChatRoute("/app")).toBe(false);
  });

  it("ignores the reports route", () => {
    mocks.isDemo = true;
    expect(isChatRoute("/app/dashboard")).toBe(false);
  });
});
