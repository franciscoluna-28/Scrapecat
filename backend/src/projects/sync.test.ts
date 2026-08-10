import { describe, expect, it } from "vitest";
import { isNewerThanWatermark } from "@/projects/sync";

describe("isNewerThanWatermark", () => {
  const wmDate = new Date("2026-07-31T10:00:00.000Z");
  const wmSha = "aaaa";

  it("returns true for a strictly newer date", () => {
    expect(isNewerThanWatermark("2026-08-01T00:00:00Z", "bbbb", wmDate, wmSha)).toBe(true);
  });

  it("returns false for a strictly older date", () => {
    expect(isNewerThanWatermark("2026-07-01T00:00:00Z", "bbbb", wmDate, wmSha)).toBe(false);
  });

  it("breaks the tie with the SHA on equal dates", () => {
    expect(isNewerThanWatermark("2026-07-31T10:00:00.000Z", "bbbb", wmDate, wmSha)).toBe(true);
    expect(isNewerThanWatermark("2026-07-31T10:00:00.000Z", "aa00", wmDate, wmSha)).toBe(false);
  });

  it("returns false for the exact watermark commit", () => {
    expect(isNewerThanWatermark("2026-07-31T10:00:00.000Z", "aaaa", wmDate, wmSha)).toBe(false);
  });
});
