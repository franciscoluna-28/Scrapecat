import { describe, expect, it } from "vitest";
import { buildChatUrl } from "./chat-url";

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
