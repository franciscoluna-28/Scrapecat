import { describe, it, expect } from "vitest";
import { formatDate } from "@/shared/utils";

describe("formatDate", () => {
  it("returns YYYY-MM-DD", () => {
    expect(formatDate(new Date("2026-01-15T00:00:00Z"))).toBe("2026-01-15");
  });
});
