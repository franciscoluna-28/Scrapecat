import { describe, it, expect } from "vitest";
import type { ChatMessage } from "@/src/shared/types";
import {
  STREAMING_PREFIX,
  chatMessagesReducer,
  createChatMessagesState,
} from "./live-messages";

const SESSION_KEY = "project-1:session-1";

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

function renderDraft(includeUser = true) {
  return chatMessagesReducer(createChatMessagesState(SESSION_KEY), {
    type: "draft",
    sessionKey: SESSION_KEY,
    userMessage: user,
    draft,
    includeUser,
  });
}

describe("chatMessagesReducer", () => {
  it("starts empty", () => {
    expect(createChatMessagesState(SESSION_KEY)).toEqual({
      sessionKey: SESSION_KEY,
      messages: [],
      progress: null,
    });
  });

  it("adds the user message and draft when includeUser is true", () => {
    expect(renderDraft(true).messages.map((m) => m.id)).toEqual([user.id, draft.id]);
  });

  it("skips the user message when includeUser is false", () => {
    expect(renderDraft(false).messages.map((m) => m.id)).toEqual([draft.id]);
  });

  it("appends and accumulates tokens on the streaming message", () => {
    const once = chatMessagesReducer(renderDraft(), {
      type: "token",
      sessionKey: SESSION_KEY,
      content: "a",
    });
    const twice = chatMessagesReducer(once, {
      type: "token",
      sessionKey: SESSION_KEY,
      content: "b",
    });
    expect(twice.messages[1].content).toBe("ab");
  });

  it("is a no-op for tokens without a draft", () => {
    const state = createChatMessagesState(SESSION_KEY);
    expect(chatMessagesReducer(state, { type: "token", sessionKey: SESSION_KEY, content: "x" })).toBe(
      state,
    );
  });

  it("stores progress and clears it", () => {
    const progress = { type: "progress" as const, stage: "ingest", message: "working" };
    const withProgress = chatMessagesReducer(renderDraft(), {
      type: "progress",
      sessionKey: SESSION_KEY,
      progress,
    });
    expect(withProgress.progress).toEqual(progress);

    const cleared = chatMessagesReducer(withProgress, {
      type: "progress",
      sessionKey: SESSION_KEY,
      progress: null,
    });
    expect(cleared.progress).toBeNull();
  });

  it("replaces the draft with the final message", () => {
    const final = message("server-1", "full reply");
    const result = chatMessagesReducer(renderDraft(), {
      type: "done",
      sessionKey: SESSION_KEY,
      message: final,
    });
    expect(result.messages.map((m) => m.id)).toEqual([user.id, final.id]);
    expect(result.messages[1].content).toBe("full reply");
  });

  it("removes only the streaming draft on error", () => {
    const result = chatMessagesReducer(renderDraft(), {
      type: "error",
      sessionKey: SESSION_KEY,
    });
    expect(result.messages.map((m) => m.id)).toEqual([user.id]);
  });

  it("clears messages and progress", () => {
    const withProgress = chatMessagesReducer(renderDraft(), {
      type: "progress",
      sessionKey: SESSION_KEY,
      progress: { type: "progress", stage: "ingest", message: "working" },
    });
    const result = chatMessagesReducer(withProgress, {
      type: "clear",
      sessionKey: SESSION_KEY,
    });
    expect(result.messages).toEqual([]);
    expect(result.progress).toBeNull();
  });

  it("resets when actions target a different session", () => {
    const result = chatMessagesReducer(renderDraft(), {
      type: "token",
      sessionKey: "project-1:session-2",
      content: "x",
    });
    expect(result.sessionKey).toBe("project-1:session-2");
    expect(result.messages).toEqual([]);
  });
});
