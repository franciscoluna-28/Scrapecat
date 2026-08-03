import type { CommitDetail } from "@/shared/integrations/git-provider";

const MAX_PATCH_LINES_PER_FILE = 50;
const MAX_TOTAL_LINES = 500;
const MAX_SUMMARY_LENGTH = 6000;

export function buildDiffSummary(detail: CommitDetail): string {
  const parts: string[] = [detail.message.trim()];
  const stats = detail.stats ?? { additions: 0, deletions: 0, total: 0 };
  parts.push(`${detail.files.length} file(s) changed, +${stats.additions} -${stats.deletions}`);

  let totalLines = 0;
  for (const file of detail.files) {
    if (totalLines >= MAX_TOTAL_LINES) break;
    parts.push("");
    parts.push(`File: ${file.filename} (+${file.additions} -${file.deletions})`);
    if (file.patch) {
      const lines = file.patch.split("\n").slice(0, MAX_PATCH_LINES_PER_FILE);
      totalLines += lines.length;
      parts.push(lines.join("\n"));
    }
  }

  return parts.join("\n").slice(0, MAX_SUMMARY_LENGTH);
}
