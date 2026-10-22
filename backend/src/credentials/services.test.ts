import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsertCredential = vi.fn();
const mockGetLatestCredential = vi.fn();
const mockListCredentials = vi.fn();
const mockGetCredentialById = vi.fn();
const mockDeleteCredentialById = vi.fn();

vi.mock("@/credentials/stores/credentials-store", () => ({
  upsertCredential: (...args: unknown[]) => mockUpsertCredential(...args),
  getLatestCredential: (...args: unknown[]) => mockGetLatestCredential(...args),
  listCredentials: (...args: unknown[]) => mockListCredentials(...args),
  getCredentialById: (...args: unknown[]) => mockGetCredentialById(...args),
  deleteCredentialById: (...args: unknown[]) => mockDeleteCredentialById(...args),
}));

import { env } from "@/config/env";
import { decrypt } from "@/credentials/encryption";
import {
  createCredential,
  resolveApiKey,
  verifyCredential,
} from "@/credentials/services";

describe("createCredential", () => {
  beforeEach(() => {
    mockUpsertCredential.mockReset().mockResolvedValue({ id: "credential-1" });
  });

  it("encrypts the key and stores only a hint", async () => {
    const id = await createCredential({
      provider: "openai",
      key: "sk-1234567890",
    });

    expect(id).toBe("credential-1");
    const stored = mockUpsertCredential.mock.calls[0][0];
    expect(stored.provider).toBe("openai");
    expect(stored.encryptedKey).not.toContain("sk-1234567890");
    expect(decrypt(stored.encryptedKey)).toBe("sk-1234567890");
    expect(stored.keyHint).toBe("sk-1••••••••7890");
  });

  it("rejects an unsupported provider before writing", async () => {
    await expect(
      createCredential({ provider: "not-a-provider", key: "secret" }),
    ).rejects.toThrow("Unsupported provider");

    expect(mockUpsertCredential).not.toHaveBeenCalled();
  });
});

describe("resolveApiKey", () => {
  beforeEach(() => {
    mockGetLatestCredential.mockReset().mockResolvedValue(null);
    vi.unstubAllGlobals();
  });

  it("prefers the stored credential over the environment", async () => {
    mockGetLatestCredential.mockResolvedValue({
      encryptedKey: (await import("@/credentials/encryption")).encrypt("sk-stored"),
    });

    await expect(resolveApiKey("openai")).resolves.toBe("sk-stored");
  });

  it("falls back to the provider environment key", async () => {
    const original = env.OPENAI_API_KEY;
    env.OPENAI_API_KEY = "sk-from-env";

    try {
      await expect(resolveApiKey("openai")).resolves.toBe("sk-from-env");
    } finally {
      env.OPENAI_API_KEY = original;
    }
  });

  it("returns null for an unknown provider", async () => {
    await expect(resolveApiKey("not-a-provider")).resolves.toBeNull();
  });
});

describe("verifyCredential", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for a successful probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCredential("openrouter", "sk-test")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/auth/key",
      { headers: { Authorization: "Bearer sk-test" } },
    );
  });

  it("returns false for a rejected probe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401 }));

    await expect(verifyCredential("openrouter", "sk-bad")).resolves.toBe(false);
  });

  it("returns false when the probe throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(verifyCredential("openrouter", "sk-test")).resolves.toBe(false);
  });

  it("returns false for an unknown provider", async () => {
    await expect(verifyCredential("not-a-provider", "secret")).resolves.toBe(false);
  });
});
