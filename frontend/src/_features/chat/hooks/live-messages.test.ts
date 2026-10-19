import { describe, it, expect } from "vitest";
import type { ChatMessage } from "@/src/shared/types";
import {
  STREAMING_PREFIX,
  appendDraft,
  appendToken,
  replaceStreaming,
  removeStreaming,
} from "./live-messages";

function message(id: string, content = "", role: ChatMessage["role"] = "assistant"): ChatMessage {
  return {
    id,
    role,
    content,
    branch: null,
    citations: [],
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

const user = message("local-user-1", "hello", "user");
const draft = message(`${STREAMING_PREFIX}-1`);

describe("appendDraft", () => {
  it("appends the user message and draft when includeUser is true", () => {
    const result = appendDraft([], user, draft, true);
    expect(result.map((m) => m.id)).toEqual([user.id, draft.id]);
  });

  it("skips the user message when includeUser is false", () => {
    const result = appendDraft([], user, draft, false);
    expect(result.map((m) => m.id)).toEqual([draft.id]);
  });
});

describe("appendToken", () => {
  it("appends content to the streaming message", () => {
    const result = appendToken([user, draft], "hi");
    expect(result[1].content).toBe("hi");
  });

  it("accumulates successive tokens", () => {
    const once = appendToken([draft], "a");
    const twice = appendToken(once, "b");
    expect(twice[0].content).toBe("ab");
  });

  it("leaves non-streaming messages untouched and is a no-op without a draft", () => {
    const result = appendToken([user], "x");
    expect(result).toEqual([user]);
  });
});

describe("replaceStreaming", () => {
  it("swaps the draft for the final message", () => {
    const final = message("server-1", "full reply");
    const result = replaceStreaming([user, draft], final);
    expect(result.map((m) => m.id)).toEqual([user.id, final.id]);
    expect(result[1].content).toBe("full reply");
  });

  it("is a no-op when there is no draft", () => {
    expect(replaceStreaming([user], message("server-1"))).toEqual([user]);
  });
});

describe("removeStreaming", () => {
  it("removes only the streaming draft", () => {
    const result = removeStreaming([user, draft]);
    expect(result.map((m) => m.id)).toEqual([user.id]);
  });
});
