export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function extractReportTitle(markdown: string, fallback: string): string {
  const line = markdown
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("# ") && !l.startsWith("## "));
  return line ? line.replace(/^#\s+/, "").trim() : fallback;
}
