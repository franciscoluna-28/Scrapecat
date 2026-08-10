import { describe, expect, it } from "vitest";
import {
  encodeReportCommitsCursor,
  decodeReportCommitsCursor,
} from "@/reports/stores/report-commits-store";

describe("report commits cursor", () => {
  it("round-trips a cursor", () => {
    const cursor = { at: "2026-08-01T10:00:00.000Z", id: "abc-123" };
    const encoded = encodeReportCommitsCursor(cursor);
    expect(encoded).not.toContain("2026"); // opaque
    expect(decodeReportCommitsCursor(encoded)).toEqual(cursor);
  });

  it("rejects a malformed cursor", () => {
    expect(() => decodeReportCommitsCursor("not-base64!!")).toThrow();
    expect(() =>
      decodeReportCommitsCursor(
        Buffer.from(JSON.stringify({ at: "nope", id: "x" })).toString("base64url"),
      ),
    ).toThrow();
    expect(() =>
      decodeReportCommitsCursor(
        Buffer.from(JSON.stringify({ at: "2026-01-01T00:00:00Z" })).toString("base64url"),
      ),
    ).toThrow();
  });
});
