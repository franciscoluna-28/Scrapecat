import { describe, expect, it } from "vitest";
import { envSchema } from "@/config/env";
import { getCatalogModels } from "@/shared/integrations/providers/catalog";
import {
  PROVIDER_REGISTRY,
  getProviderConfig,
  isProviderSupported,
} from "@/shared/integrations/providers/registry";

const PROTOCOLS = new Set([
  "openai-chat",
  "openai-responses",
  "anthropic-messages",
  "google-generative",
]);

describe("AI provider registry", () => {
  it("registers every provider with a resolvable environment key", () => {
    for (const [name, config] of Object.entries(PROVIDER_REGISTRY)) {
      expect(envSchema.shape).toHaveProperty(config.envKey);
      expect(getProviderConfig(name)).toBe(config);
      expect(isProviderSupported(name)).toBe(true);
    }
  });

  it("uses a supported default protocol for every provider", () => {
    for (const config of Object.values(PROVIDER_REGISTRY)) {
      expect(PROTOCOLS.has(config.defaultProtocol)).toBe(true);
    }
  });

  it("provides a protocol-specific base URL for the default protocol", () => {
    for (const config of Object.values(PROVIDER_REGISTRY)) {
      if (!("protocolBaseUrls" in config)) continue;
      expect(config.protocolBaseUrls?.[config.defaultProtocol]).toBeDefined();
    }
  });

  it("keeps every catalog model on a supported protocol", () => {
    for (const provider of Object.keys(PROVIDER_REGISTRY)) {
      for (const model of getCatalogModels(provider)) {
        expect(PROTOCOLS.has(model.protocol)).toBe(true);
      }
    }
  });

  it("returns undefined for an unknown provider", () => {
    expect(getProviderConfig("not-a-provider")).toBeUndefined();
    expect(isProviderSupported("not-a-provider")).toBe(false);
  });
});
