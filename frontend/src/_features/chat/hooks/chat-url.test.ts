import { describe, expect, it } from "vitest";
import { buildChatUrl } from "./chat-url";

describe("buildChatUrl", () => {
  it("drops the one-shot q prompt and pins project/session", () => {
    const url = buildChatUrl("/app", "?q=hello&project=old", "p1", "s1");
    expect(url).toBe("/app?project=p1&session=s1");
  });

  it("keeps unrelated params such as branch", () => {
    const url = buildChatUrl("/app", "?branch=dev&q=hello", "p1", "s1");
    expect(url).toBe("/app?branch=dev&project=p1&session=s1");
  });

  it("overwrites stale project/session values", () => {
    const url = buildChatUrl("/app", "?project=old&session=old-session", "p1", "s1");
    expect(url).toBe("/app?project=p1&session=s1");
  });
});
