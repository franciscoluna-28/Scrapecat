import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommitCitationCard } from "./CommitCitationCard";
import type { ChatMessage } from "@/src/shared/types";

type Citation = ChatMessage["citations"][number];

function citation(overrides: Partial<Citation> = {}): Citation {
  return {
    commitSha: "abcdef1234567890",
    commitMessage: "add rag chat",
    author: "dev",
    committedAt: "2024-01-01T00:00:00.000Z",
    filesChanged: ["src/chat/routes.ts"],
    commitUrl: "https://github.com/owner/repo/commit/abcdef1234567890",
    ...overrides,
  };
}

describe("CommitCitationCard", () => {
  it("renders the message and the 7-character short sha", () => {
    render(<CommitCitationCard citation={citation()} />);
    expect(screen.getByText("add rag chat")).toBeInTheDocument();
    expect(screen.getByText("abcdef1")).toBeInTheDocument();
  });

  it("truncates long commit messages with an ellipsis", () => {
    const long = "x".repeat(150);
    render(<CommitCitationCard citation={citation({ commitMessage: long })} />);
    expect(screen.getByText(`${"x".repeat(100)}…`)).toBeInTheDocument();
  });

  it("renders the author when present", () => {
    render(<CommitCitationCard citation={citation({ author: "octocat" })} />);
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("links to the commit when a URL is available", () => {
    render(<CommitCitationCard citation={citation()} />);
    const link = screen.getByLabelText("Open commit");
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/owner/repo/commit/abcdef1234567890",
    );
  });
});
