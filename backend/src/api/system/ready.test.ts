import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/system/services", () => ({ checkDatabase: vi.fn() }));

import { ready } from "@/api/system/routes";
import { checkDatabase } from "@/api/system/services";

const mockedCheckDatabase = vi.mocked(checkDatabase);

function fakeReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
}

describe("GET /api/v1/health/ready", () => {
  beforeEach(() => mockedCheckDatabase.mockReset());

  it("returns ok when the database responds", async () => {
    mockedCheckDatabase.mockResolvedValue(true);
    const reply = fakeReply();

    const result = await ready({} as never, reply as never);

    expect(result).toEqual({ status: "ok" });
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("returns 503 when the database is unavailable", async () => {
    mockedCheckDatabase.mockResolvedValue(false);
    const reply = fakeReply();

    const result = await ready({} as never, reply as never);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(result).toEqual({ status: "error" });
  });
});
