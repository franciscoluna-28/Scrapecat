import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const mockProvider = {
  listRepositories: vi.fn(),
  listBranches: vi.fn(),
  getDefaultBranch: vi.fn(),
  verifyConnection: vi.fn(),
};

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

const mockStore = {
  upsertCredential: vi.fn(),
  getLatestCredential: vi.fn(),
  deleteCredentialById: vi.fn(),
};

vi.mock("@/credentials/stores/credentials-store", () => ({
  upsertCredential: (...args: unknown[]) => mockStore.upsertCredential(...args),
  getLatestCredential: (...args: unknown[]) => mockStore.getLatestCredential(...args),
  deleteCredentialById: (...args: unknown[]) => mockStore.deleteCredentialById(...args),
}));

vi.mock("@/credentials/encryption", () => ({
  encrypt: (plain: string) => plain,
  decrypt: (encoded: string) => encoded,
  maskApiKey: (key: string) => `${key.slice(0, 4)}••••`,
}));

import { buildApp } from "@/app";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/github/token", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("stores a valid token and returns the login", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: "octocat" }),
    } as Response);
    mockStore.upsertCredential.mockResolvedValue({ id: "1" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/github/token",
      payload: { token: "ghp_valid" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ connected: true, source: "token", login: "octocat" });
    expect(mockStore.upsertCredential).toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Bad credentials" }),
    } as Response);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/github/token",
      payload: { token: "ghp_bad" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
    expect(mockStore.upsertCredential).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/github/connection", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("reports not connected when no token is available", async () => {
    mockStore.getLatestCredential.mockResolvedValue(null);
    mockProvider.verifyConnection.mockReset();

    const res = await app.inject({ method: "GET", url: "/api/v1/github/connection" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ connected: false, source: "none" });
    expect(mockProvider.verifyConnection).not.toHaveBeenCalled();
  });

  it("reports connected via stored token with login", async () => {
    mockStore.getLatestCredential.mockResolvedValue({
      id: "1",
      encryptedKey: "x",
      keyHint: "ghp_••••",
    });
    mockProvider.verifyConnection.mockResolvedValue({ login: "octocat", rateLimitRemaining: 4999 });

    const res = await app.inject({ method: "GET", url: "/api/v1/github/connection" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ connected: true, source: "token", login: "octocat" });
  });
});

describe("DELETE /api/v1/github/connection", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when nothing is connected", async () => {
    mockStore.getLatestCredential.mockResolvedValue(null);

    const res = await app.inject({ method: "DELETE", url: "/api/v1/github/connection" });
    expect(res.statusCode).toBe(404);
  });

  it("deletes the stored credential", async () => {
    mockStore.getLatestCredential.mockResolvedValue({ id: "1" });
    mockStore.deleteCredentialById.mockResolvedValue(true);

    const res = await app.inject({ method: "DELETE", url: "/api/v1/github/connection" });
    expect(res.statusCode).toBe(204);
    expect(mockStore.deleteCredentialById).toHaveBeenCalledWith("1");
  });
});
