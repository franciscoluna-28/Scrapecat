import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DEMO_MODE = "true";
});

import { buildApp } from "@/build-app";

describe("telemetry routes in demo mode", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects every ingestion runs read", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/telemetry/ingestion-runs",
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: "Ingestion telemetry is not available in demo mode",
    });
  });

  it("rejects filtered reads too", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/telemetry/ingestion-runs?limit=1&windowDays=30",
    });

    expect(res.statusCode).toBe(403);
  });
});
