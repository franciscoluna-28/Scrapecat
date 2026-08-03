import { z } from "zod";

export const parsedItemSchema = z.object({
  text: z.string().min(1),
});

export const parsedSectionSchema = z.object({
  heading: z.string().min(1),
  items: z.array(z.string().min(1)).min(1),
});

export const parsedReportSchema = z.object({
  title: z.string().min(1),
  sections: z.array(parsedSectionSchema).min(2).max(4),
  strategicDirection: z.string().min(1),
});

export type ParsedReport = z.infer<typeof parsedReportSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsed: ParsedReport | null;
}

export function parseReportMarkdown(markdown: string): ParsedReport | null {
  const lines = markdown.split("\n").map((l) => l.trim());
  const titleLine = lines.find((l) => l.startsWith("# ") && !l.startsWith("## ") && !l.startsWith("### "));
  if (!titleLine) return null;
  const title = titleLine.replace(/^#\s+/, "").trim();

  const sections: { heading: string; items: string[] }[] = [];
  let currentSection: { heading: string; items: string[] } | null = null;
  let strategicDirection = "";

  const h3Lines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("### ")) {
      const h3 = line.replace(/^###\s+/, "").trim().toLowerCase();
      if (h3 === "strategic direction") {
        if (currentSection) {
          sections.push(currentSection);
          currentSection = null;
        }
      }
      continue;
    }

    if (!currentSection && !line.startsWith("#")) {
      if (line.startsWith("- ")) {
        h3Lines.push(line.replace(/^-\s+/, "").trim());
      } else if (line.trim() && !line.startsWith("---") && !line.startsWith("***")) {
        h3Lines.push(line);
      }
      continue;
    }

    if (line.startsWith("## ")) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: line.replace(/^##\s+/, "").trim(), items: [] };
      continue;
    }

    if (line.startsWith("- ")) {
      const bulletText = line.replace(/^-\s+/, "").trim();
      if (currentSection) {
        currentSection.items.push(bulletText);
      } else {
        h3Lines.push(bulletText);
      }
      continue;
    }

    if (line && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("---") && !line.startsWith("***")) {
      if (!currentSection && h3Lines.length > 0) {
        h3Lines.push(line);
      }
    }
  }

  if (currentSection) sections.push(currentSection);

  if (h3Lines.length > 0) {
    strategicDirection = h3Lines.join(" ").trim();
  }

  return { title, sections, strategicDirection };
}

export function validateReportStructure(markdown: string): ValidationResult {
  const parsed = parseReportMarkdown(markdown);
  if (!parsed) {
    return { valid: false, errors: ["Could not parse markdown structure"], parsed: null };
  }

  const result = parsedReportSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return { valid: false, errors, parsed };
  }

  for (let i = 0; i < result.data.sections.length; i++) {
    const sec = result.data.sections[i];
    if (!sec.heading || sec.heading.length === 0) {
      return { valid: false, errors: [`sections[${i}].heading is empty`], parsed };
    }
    if (!sec.items || sec.items.length === 0) {
      return { valid: false, errors: [`sections[${i}].items is empty`], parsed };
    }
  }

  return { valid: true, errors: [], parsed: result.data };
}

export const REPORT_TEMPLATE = `# Product Update - {{PROJECT_NAME}}

## {{SECTION_HEADING_1}}
- {{ITEM_DESCRIPTION}}

## {{SECTION_HEADING_2}}
- {{ITEM_DESCRIPTION}}
- {{ITEM_DESCRIPTION}}

### Strategic Direction
{{STRATEGIC_DIRECTION_TEXT}}`;

export function buildTemplateInstruction(): string {
  return [
    "",
    "Write your response as a markdown report following this exact structure (fill in the placeholders):",
    "",
    REPORT_TEMPLATE,
    "",
    "Rules:",
    "- Use \"# Product Update - [Project Name]\" as the title",
    "- Create 2-4 H2 sections (##), each with 1-4 bullet points",
    '- End with "### Strategic Direction" followed by 1-3 sentences of strategic outlook',
    "- Use outcome-oriented language, focus on product value, not technical details",
    "- Do not use separators (---, ***)",
    "- Do not mention individual developer names",
  ].join("\n");
}
