import { describe, it, expect } from "vitest";
import { parseReportMarkdown, validateReportStructure, REPORT_TEMPLATE, buildTemplateInstruction } from "./report-output";

const VALID_REPORT = `# Product Update - fabric-ai

## Core Feature Enhancements
- Integrated OpenRouter API to provide expanded AI model selection
- Introduced a "Quick Mode" for report generation

## Platform Architecture & Scalability
- Transitioned to a robust monorepo architecture
- Standardized the API layer with versioning

### Strategic Direction
The platform has transitioned from a prototype to a scalable, production-ready architecture.`;

describe("parseReportMarkdown", () => {
  it("parses a valid report", () => {
    const result = parseReportMarkdown(VALID_REPORT);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Product Update - fabric-ai");
    expect(result!.sections).toHaveLength(2);
    expect(result!.sections[0].heading).toBe("Core Feature Enhancements");
    expect(result!.sections[0].items).toHaveLength(2);
    expect(result!.sections[1].heading).toBe("Platform Architecture & Scalability");
    expect(result!.strategicDirection).toContain("production-ready");
  });

  it("returns null when no title found", () => {
    const result = parseReportMarkdown("Just some text\nno heading");
    expect(result).toBeNull();
  });

  it("returns null for empty input", () => {
    const result = parseReportMarkdown("");
    expect(result).toBeNull();
  });

  it("parses report with single bullet per section", () => {
    const input = `# Test Report

## Section One
- Single bullet

### Strategic Direction
One sentence.`;
    const result = parseReportMarkdown(input);
    expect(result).not.toBeNull();
    expect(result!.sections).toHaveLength(1);
    expect(result!.sections[0].items).toHaveLength(1);
  });
});

describe("validateReportStructure", () => {
  it("returns valid for a well-formed report", () => {
    const result = validateReportStructure(VALID_REPORT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.parsed).not.toBeNull();
  });

  it("returns invalid for report with no sections", () => {
    const input = `# Title Only

### Strategic Direction
Nothing here.`;
    const result = validateReportStructure(input);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns invalid for empty string", () => {
    const result = validateReportStructure("");
    expect(result.valid).toBe(false);
  });

  it("returns invalid for report with empty section items", () => {
    const input = `# Title

## Empty Section

### Strategic Direction
None.`;
    const result = validateReportStructure(input);
    expect(result.valid).toBe(false);
  });
});

describe("REPORT_TEMPLATE", () => {
  it("contains expected placeholders", () => {
    expect(REPORT_TEMPLATE).toContain("Product Update");
    expect(REPORT_TEMPLATE).toContain("Strategic Direction");
  });
});

describe("buildTemplateInstruction", () => {
  it("returns instruction string with template", () => {
    const result = buildTemplateInstruction();
    expect(result).toContain("Product Update");
    expect(result).toContain("Strategic Direction");
    expect(result).toContain("H2 sections");
  });
});
