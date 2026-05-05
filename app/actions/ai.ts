import Groq from "groq-sdk";

interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
}

interface ReportData {
  repository: string;
  branch: string;
  startDate: string;
  endDate: string;
  commits: CommitData[];
}

export async function generateCommitReport(
  reportData: ReportData,
): Promise<string> {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Limit commits to reduce token usage
    const limitedCommits = reportData.commits.slice(0, 10);
    
    const systemPrompt = "Generate a concise technical report in markdown format.";

    const prompt = `Repository: ${reportData.repository}
Branch: ${reportData.branch}
Commits: ${limitedCommits.length}

Recent commits:
${limitedCommits
  .map(
    (commit) =>
      `- ${commit.author}: ${commit.message.split('\n')[0]}`,
  )
  .join("\n")}

Create a brief technical report with:
1. Overview (2-3 sentences)
2. Key changes (3-4 bullet points)
3. Technical insights (2-3 sentences)
4. Recommendations (2-3 bullet points)

Keep it under 300 words.`;

    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return result.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error("Error generating technical report:", error);
    
    // Handle rate limit gracefully
    if (error?.status === 429) {
      return "# Technical Report\n\n## Overview\nUnable to generate report due to API rate limits. Please try again later.\n\n## Key Changes\nReport generation temporarily unavailable.\n\n## Technical Insights\nRate limit reached. Consider upgrading API plan for higher limits.\n\n## Recommendations\n- Wait a few minutes before retrying\n- Consider reducing commit data size";
    }
    
    throw error;
  }
}

export async function generateExecutiveSummary(
  reportData: ReportData,
): Promise<string> {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Limit commits to reduce token usage
    const limitedCommits = reportData.commits.slice(0, 10);
    
    const systemPrompt = "Generate a concise executive summary for non-technical stakeholders.";

    const prompt = `Repository: ${reportData.repository}
Branch: ${reportData.branch}
Commits: ${limitedCommits.length}

Recent activity:
${limitedCommits
  .map((commit) => `- ${commit.author}: ${commit.message.split("\n")[0]}`)
  .join("\n")}

Create a brief executive summary with:
1. Business impact (2-3 sentences)
2. Key achievements (3-4 bullet points)
3. Productivity overview (2-3 sentences)
4. Strategic insights (2-3 bullet points)

Use simple language. Keep under 250 words.`;

    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    return result.choices[0]?.message?.content || "";
  } catch (error: any) {
    console.error("Error generating executive summary:", error);
    
    // Handle rate limit gracefully
    if (error?.status === 429) {
      return "# Executive Summary\n\n## Business Impact\nUnable to generate summary due to API rate limits. Please try again later.\n\n## Key Achievements\nReport generation temporarily unavailable.\n\n## Productivity Overview\nRate limit reached. Consider upgrading API plan for higher limits.\n\n## Strategic Insights\n- Wait a few minutes before retrying\n- Consider reducing data size for faster processing";
    }
    
    throw error;
  }
}

export async function generateMarkdownContent(
  content: string,
): Promise<string> {
  return content;
}
