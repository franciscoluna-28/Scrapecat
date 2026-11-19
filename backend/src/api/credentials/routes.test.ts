import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    upsertCredential: vi.fn(),
    listCredentials: vi.fn(),
    getLatestCredential: vi.fn(),
    getCredentialById: vi.fn(),
    deleteCredentialById: vi.fn(),
  },
}));

vi.mock("@/api/credentials/stores/credentials-store", () => ({
  credentialsStore: mockStore,
}));

vi.mock("@/api/credentials/encryption", () => ({
  encrypt: (plain: string) => plain,
  decrypt: (encoded: string) => encoded,
  maskApiKey: (key: string) => `${key.slice(0, 4)}...`,
}));

import { buildApp } from "@/build-app";

describe("POST /api/v1/credentials", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a supported provider", async () => {
    mockStore.upsertCredential.mockResolvedValue({ id: "cred-1" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/credentials",
      payload: { provider: "openrouter", key: "sk-test" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: "cred-1" });
    expect(mockStore.upsertCredential).toHaveBeenCalledWith({
      provider: "openrouter",
      encryptedKey: "sk-test",
      keyHint: "sk-t...",
    });
  });

  it("rejects an unsupported provider at the boundary", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/credentials",
      payload: { provider: "not-a-provider", key: "sk-test" },
    });

    expect(res.statusCode).toBe(400);
    expect(mockStore.upsertCredential).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/credentials/verify", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("verifies a supported provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 200 }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/verify",
      payload: { provider: "openrouter", key: "sk-test" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ valid: true });
  });

  it("rejects an unsupported provider at the boundary", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/credentials/verify",
      payload: { provider: "not-a-provider", key: "sk-test" },
    });

    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
