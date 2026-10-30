import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommitCitationCard } from "./CommitCitationCard";
import type { ChatMessage } from "@/src/shared/types";

type Citation = ChatMessage["citations"][number];

function citation(overrides: Partial<Citation> = {}): Citation {
  return {
    commitSha: "abcdef1234567890",
    commitMessage: "feat: add rag chat",
    author: "dev",
    committedAt: "2024-01-01T00:00:00.000Z",
    filesChanged: ["src/chat/routes.ts"],
    commitUrl: "https://github.com/owner/repo/commit/abcdef1234567890",
    ...overrides,
  };
}

describe("CommitCitationCard", () => {
  it("renders the subject and 7-character short sha", () => {
    render(<CommitCitationCard citation={citation()} />);
    expect(screen.getByText("feat: add rag chat")).toBeInTheDocument();
    expect(screen.getByText("abcdef1")).toBeInTheDocument();
  });

  it("renders a short, single-line description", () => {
    render(
      <CommitCitationCard
        citation={citation({
          commitMessage: "feat: add rag chat\n\n- Store chunks\n- Retrieve by embedding",
        })}
      />,
    );
    expect(screen.getByText(/Store chunks/)).toBeInTheDocument();
  });

  it("shows the full subject instead of truncating it", () => {
    const long = `feat: ${"x".repeat(150)}`;
    render(<CommitCitationCard citation={citation({ commitMessage: long })} />);
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it("renders the author when present", () => {
    render(<CommitCitationCard citation={citation({ author: "octocat" })} />);
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("shows the changed-file count", () => {
    render(
      <CommitCitationCard citation={citation({ filesChanged: ["a.ts", "b.ts"] })} />,
    );
    expect(screen.getByText("2 files")).toBeInTheDocument();
  });

  it("links the whole card to the commit", () => {
    render(<CommitCitationCard citation={citation()} />);
    const link = screen.getByLabelText("Open commit");
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/owner/repo/commit/abcdef1234567890",
    );
  });

  it("renders a non-link card when there is no URL", () => {
    render(<CommitCitationCard citation={citation({ commitUrl: null })} />);
    expect(screen.queryByLabelText("Open commit")).not.toBeInTheDocument();
  });
});
