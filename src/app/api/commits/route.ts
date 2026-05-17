import { NextRequest, NextResponse } from "next/server";
import { getRepositoryCommits } from "@/src/shared/services/github";
import { APP_CONFIG } from "@/src/shared/constants/app";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const limit = parseInt(searchParams.get("limit") || `"${APP_CONFIG.commits.MAX_LIMIT}"`);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required parameters: owner and repo" },
        { status: 400 }
      );
    }

    const commits = await getRepositoryCommits({
      owner,
      repo,
      per_page: limit,
      since: startDate || undefined,
      until: endDate || undefined,
    });

    return NextResponse.json({ commits });
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
}
