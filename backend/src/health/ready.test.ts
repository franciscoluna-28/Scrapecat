import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/health/services", () => ({ checkDatabase: vi.fn() }));

import { ready } from "@/health/routes";
import { checkDatabase } from "@/health/services";

const mockedCheckDatabase = vi.mocked(checkDatabase);

function fakeReply() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
}

describe("GET /api/v1/health/ready", () => {
  beforeEach(() => mockedCheckDatabase.mockReset());

  it("returns ok when the database responds", async () => {
    mockedCheckDatabase.mockResolvedValue(true);
    const reply = fakeReply();

    await ready({} as never, reply as never);

    expect(reply.send).toHaveBeenCalledWith({ status: "ok" });
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("returns 503 when the database is unavailable", async () => {
    mockedCheckDatabase.mockResolvedValue(false);
    const reply = fakeReply();

    await ready({} as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({ status: "error" });
  });
});
