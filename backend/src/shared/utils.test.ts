import { describe, it, expect } from "vitest";
import { formatDate, extractReportTitle } from "@/shared/utils";

describe("formatDate", () => {
  it("returns YYYY-MM-DD", () => {
    expect(formatDate(new Date("2026-01-15T00:00:00Z"))).toBe("2026-01-15");
  });
});

describe("extractReportTitle", () => {
  it("extracts the h1 from markdown", () => {
    expect(extractReportTitle("# Product Update\n\nSome text", "fallback")).toBe("Product Update");
  });

  it("ignores h2 headings", () => {
    expect(extractReportTitle("## Not The Title\n\n# The Title", "fallback")).toBe("The Title");
  });

  it("falls back when no h1 exists", () => {
    expect(extractReportTitle("just text", "fallback")).toBe("fallback");
  });
});
