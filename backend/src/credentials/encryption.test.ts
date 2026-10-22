import { describe, expect, it } from "vitest";
import { decrypt, encrypt, maskApiKey } from "@/credentials/encryption";

describe("credential encryption", () => {
  it("round-trips a secret", () => {
    const plaintext = "glpat-abcdefghijklmnopqrstuvwxyz";

    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("uses a fresh IV for every encryption", () => {
    const plaintext = "sk-same-input";

    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("rejects a tampered payload", () => {
    const encoded = encrypt("sk-secret");
    const bytes = Buffer.from(encoded, "base64url");
    bytes[13] ^= 0xff;
    const tampered = bytes.toString("base64url");

    expect(() => decrypt(tampered)).toThrow(/integrity/i);
  });

  it("rejects a payload that is too short to contain an IV and tag", () => {
    expect(() => decrypt("c2hvcnQ")).toThrow(/corrupted/i);
  });
});

describe("maskApiKey", () => {
  it("keeps a short prefix and suffix for long keys", () => {
    expect(maskApiKey("sk-1234567890")).toBe("sk-1••••••••7890");
  });

  it("never reveals more than the last two characters for short keys", () => {
    expect(maskApiKey("short")).toBe("••••rt");
  });

  it("trims surrounding whitespace before masking", () => {
    expect(maskApiKey("  sk-1234567890  ")).toBe("sk-1••••••••7890");
  });
});
