import { NextResponse } from "next/server";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  description?: string;
}

export async function GET() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API returned ${res.status}`);
    }

    const data = await res.json();

    const models: OpenRouterModel[] = data?.data || [];

    const mapped = models.map((m: OpenRouterModel) => ({
      id: m.id,
      name: m.name,
      free: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
      description: m.description || "",
    }));

    mapped.sort((a, b) => {
      if (a.free !== b.free) return a.free ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json(
      { models: mapped },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 },
    );
  }
}
