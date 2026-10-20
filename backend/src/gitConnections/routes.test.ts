import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

const mockProvider = {
  verifyConnection: vi.fn(),
};

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
  getGitProviderConfig: vi.fn((provider: string) => {
    if (provider !== "github") {
      throw new Error(`Git provider "${provider}" is not implemented yet`);
    }
    return { id: provider };
  }),
}));

const mockStore = {
  upsertCredential: vi.fn(),
  getLatestCredential: vi.fn(),
  deleteCredentialById: vi.fn(),
};

vi.mock("@/credentials/stores/credentials-store", () => ({
  upsertCredential: (...args: unknown[]) => mockStore.upsertCredential(...args),
  getLatestCredential: (...args: unknown[]) => mockStore.getLatestCredential(...args),
  deleteCredentialById: (...args: unknown[]) =>
    mockStore.deleteCredentialById(...args),
}));

vi.mock("@/credentials/encryption", () => ({
  encrypt: (plain: string) => plain,
  decrypt: (encoded: string) => encoded,
  maskApiKey: (key: string) => `${key.slice(0, 4)}...`,
}));

const mockResolveGitToken = vi.fn<() => Promise<string | null>>();

vi.mock("@/shared/integrations/git-provider/token", () => ({
  resolveGitToken: () => mockResolveGitToken(),
}));

import { buildApp } from "@/build-app";

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveGitToken.mockResolvedValue(null);
});

describe("POST /api/v1/git-providers/:provider/connection", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("stores a valid token and returns the login", async () => {
    mockProvider.verifyConnection.mockResolvedValue({
      login: "octocat",
      rateLimitRemaining: 4999,
    });
    mockStore.upsertCredential.mockResolvedValue({ id: "1" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/git-providers/github/connection",
      payload: { token: "ghp_valid" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      connected: true,
      source: "token",
      login: "octocat",
    });
    expect(mockStore.upsertCredential).toHaveBeenCalledWith({
      provider: "github",
      encryptedKey: "ghp_valid",
      keyHint: "ghp_...",
    });
  });

  it("rejects an invalid token", async () => {
    mockProvider.verifyConnection.mockRejectedValue(new Error("Bad credentials"));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/git-providers/github/connection",
      payload: { token: "ghp_bad" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
    expect(mockStore.upsertCredential).not.toHaveBeenCalled();
  });

  it("rejects an unimplemented provider", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/git-providers/gitlab/connection",
      payload: { token: "glpat" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/not implemented/);
  });
});

describe("GET /api/v1/git-providers/:provider/connection", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("reports not connected when no token is available", async () => {
    mockProvider.verifyConnection.mockReset();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/git-providers/github/connection",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ connected: false, source: "none" });
    expect(mockProvider.verifyConnection).not.toHaveBeenCalled();
  });

  it("reports connected via stored token with login", async () => {
    mockResolveGitToken.mockResolvedValue("ghp_stored");
    mockStore.getLatestCredential.mockResolvedValue({
      id: "1",
      encryptedKey: "ghp_stored",
      keyHint: "ghp_...",
    });
    mockProvider.verifyConnection.mockResolvedValue({
      login: "octocat",
      rateLimitRemaining: 4999,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/git-providers/github/connection",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      connected: true,
      source: "token",
      login: "octocat",
    });
  });

  it("reports connected via env token", async () => {
    mockResolveGitToken.mockResolvedValue("ghp_env");
    mockStore.getLatestCredential.mockResolvedValue(null);
    mockProvider.verifyConnection.mockResolvedValue({
      login: "env-user",
      rateLimitRemaining: 4999,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/git-providers/github/connection",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      connected: true,
      source: "env",
      login: "env-user",
    });
  });

  it("rejects an unimplemented provider", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/git-providers/gitlab/connection",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/not implemented/);
  });
});

describe("DELETE /api/v1/git-providers/:provider/connection", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when nothing is connected", async () => {
    mockStore.getLatestCredential.mockResolvedValue(null);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/git-providers/github/connection",
    });

    expect(res.statusCode).toBe(404);
  });

  it("deletes the stored credential", async () => {
    mockStore.getLatestCredential.mockResolvedValue({ id: "1" });
    mockStore.deleteCredentialById.mockResolvedValue(true);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/git-providers/github/connection",
    });

    expect(res.statusCode).toBe(204);
    expect(mockStore.deleteCredentialById).toHaveBeenCalledWith("1");
  });
});
