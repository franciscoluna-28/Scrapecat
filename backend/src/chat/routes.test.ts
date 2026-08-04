import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "@/app";

vi.mock("@/chat/ask", () => ({
  askAboutProject: vi.fn(),
  ChatError: class ChatError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { askAboutProject, ChatError } from "@/chat/ask";

describe("POST /api/v1/chat/ask", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(askAboutProject).mockReset();
  });

  it("returns the answer and retrieved sources", async () => {
    vi.mocked(askAboutProject).mockResolvedValue({
      answer: "AES-256-GCM credential encryption was added.",
      sources: [
        {
          commitSha: "abc1234",
          commitMessage: "feat: add credential encryption",
          author: "franciscoluna-28",
          diffSummary: "feat: add credential encryption",
          committedAt: new Date("2026-01-01T00:00:00Z"),
          similarity: 0.87,
        },
      ],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/ask",
      payload: { projectId: "p1", question: "When was encryption added?" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.answer).toContain("AES-256-GCM");
    expect(body.sources[0].similarity).toBe(0.87);
    expect(body.sources[0].commitSha).toBe("abc1234");
  });

  it("returns 400 for a missing question", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/ask",
      payload: { projectId: "p1" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the project does not exist", async () => {
    vi.mocked(askAboutProject).mockRejectedValue(new ChatError("Project not found", 404));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/ask",
      payload: { projectId: "nope", question: "hi" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 429 when the provider rate-limits us", async () => {
    vi.mocked(askAboutProject).mockRejectedValue({ status: 429 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/ask",
      payload: { projectId: "p1", question: "hi" },
    });

    expect(res.statusCode).toBe(429);
  });
});
