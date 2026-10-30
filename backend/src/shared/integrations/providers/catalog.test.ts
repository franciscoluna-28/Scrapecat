import { describe, expect, it } from "vitest";
import {
  getCatalogModels,
  resolveModel,
} from "@/shared/integrations/providers/catalog";
import { PROVIDER_REGISTRY } from "@/shared/integrations/providers/registry";

describe("model catalog", () => {
  it("resolves each OpenCode Go model to its transport protocol", () => {
    expect(
      resolveModel("opencode-go", "grok-4.7", "openai-chat").protocol,
    ).toBe("openai-responses");
    expect(
      resolveModel("opencode-go", "claude-haiku-5-5", "openai-chat").protocol,
    ).toBe("anthropic-messages");
    expect(
      resolveModel("opencode-go", "deepseek-v4.1-flash", "openai-chat").protocol,
    ).toBe("openai-chat");
  });

  it("falls back to the provider default protocol for unknown model ids", () => {
    expect(resolveModel("opencode-go", "not-a-model", "openai-chat")).toEqual({
      id: "not-a-model",
      name: "not-a-model",
      protocol: "openai-chat",
      free: false,
      description: "",
    });
  });

  it("has a catalog entry for every registered provider", () => {
    for (const provider of Object.keys(PROVIDER_REGISTRY)) {
      expect(Array.isArray(getCatalogModels(provider))).toBe(true);
    }
  });
});
