import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DEMO_MODE = "true";
});

import { buildApp } from "@/build-app";

describe("report routes in demo mode", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("disables schedule reads", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/report-schedules",
    });

    expect(res.statusCode).toBe(403);
  });

  it("disables schedule creation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/report-schedules",
      payload: {
        projectId: "22222222-2222-4222-8222-222222222222",
        branch: "main",
        cadence: "daily",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("disables reports", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports",
    });

    expect(res.statusCode).toBe(403);
  });

  it("disables a single report", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/33333333-3333-4333-8333-333333333333",
    });

    expect(res.statusCode).toBe(403);
  });

  it("disables manual runs", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/report-schedules/11111111-1111-4111-8111-111111111111/run",
    });

    expect(res.statusCode).toBe(403);
  });
});
