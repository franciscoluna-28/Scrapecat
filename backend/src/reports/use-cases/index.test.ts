import { describe, it, expect } from "vitest";
import { AIGenerationError } from "@/reports/use-cases";

describe("AIGenerationError", () => {
  it("maps rate-limit errors to a 429 with a retry message", () => {
    const err = AIGenerationError.from({ status: 429 });
    expect(err.status).toBe(429);
    expect(err.message).toContain("rate limit");
  });

  it("maps other AI failures to a generic 500", () => {
    const err = AIGenerationError.from(new Error("boom"));
    expect(err.status).toBe(500);
    expect(err.message).toContain("Please try again");
  });

  it("is a proper Error subclass", () => {
    expect(AIGenerationError.from(new Error("x"))).toBeInstanceOf(Error);
  });
});
