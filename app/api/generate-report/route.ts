import { generateText } from "ai";
import { z } from "zod";

const reportSchema = z.object({
  repository: z.string(),
  branch: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  commits: z.array(
    z.object({
      sha: z.string(),
      message: z.string(),
      author: z.string(),
      date: z.string(),
      url: z.string().optional(),
    }),
  ),
});

// TODO: Optimize and polish core logic and model usage
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reportType, data } = body;

    const validatedData = reportSchema.parse(data);

    let prompt = "";
    let systemPrompt = "";

    if (reportType === "technical") {
      systemPrompt =
        "You are a technical report generator. Create a detailed technical report for developers based on the provided commit data. Use markdown formatting and include technical details, code references, and development insights.";

      prompt = `Generate a technical report for the following repository data:

Repository: ${validatedData.repository}
Branch: ${validatedData.branch}
Date Range: ${validatedData.startDate} to ${validatedData.endDate}
Total Commits: ${validatedData.commits.length}

Commits:
${validatedData.commits
  .map(
    (commit) =>
      `- SHA: ${commit.sha.substring(0, 7)}
  Author: ${commit.author}
  Date: ${commit.date}
  Message: ${commit.message}`,
  )
  .join("\n")}

Please create a comprehensive technical report that includes:
1. Overview and statistics
2. Detailed commit analysis
3. Code quality insights
4. Development trends
5. Technical recommendations

Use proper markdown formatting with headers, bullet points, and code blocks where appropriate.`;
    } else if (reportType === "executive") {
      systemPrompt =
        "You are a business analyst creating executive summaries for non-technical stakeholders. Translate technical commit data into business insights and impact. Use simple language and focus on business value.";

      prompt = `Generate an executive summary for the following repository data:

Repository: ${validatedData.repository}
Branch: ${validatedData.branch}
Date Range: ${validatedData.startDate} to ${validatedData.endDate}
Total Commits: ${validatedData.commits.length}

Recent Activity:
${validatedData.commits
  .slice(0, 10)
  .map((commit) => `- ${commit.author}: ${commit.message.split("\n")[0]}`)
  .join("\n")}

Please create an executive summary that includes:
1. Business impact overview
2. Key accomplishments
3. Productivity metrics
4. Risk assessment
5. Strategic recommendations

Use simple, non-technical language suitable for executives and stakeholders. Focus on business value and outcomes rather than technical details.`;
    } else {
      return new Response("Invalid report type", { status: 400 });
    }

    const result = await generateText({
      model: "alibaba/qwen-3-14b",
      system: systemPrompt,
      prompt: prompt,
      temperature: 0.7,
    });

    return new Response(JSON.stringify({ report: result.text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return new Response("Failed to generate report", { status: 500 });
  }
}
