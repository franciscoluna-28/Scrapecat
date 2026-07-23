import { NextRequest, NextResponse } from "next/server";
import { getRepositoryCommitCount } from "@/src/shared/services/github";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required parameters: owner and repo" },
        { status: 400 }
      );
    }

    const count = await getRepositoryCommitCount({
      owner,
      repo,
      since: startDate || undefined,
      until: endDate || undefined,
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching commit count:", error);
    return NextResponse.json(
      { error: "Failed to fetch commit count" },
      { status: 500 }
    );
  }
}
