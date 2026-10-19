import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepositoryList } from "./RepositoryList";
import type { GitHubRepository } from "@/src/shared/types";

function repo(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id: "1",
    name: "repo",
    full_name: "owner/repo",
    private: false,
    updated_at: "2024-01-01T00:00:00Z",
    owner: { login: "owner" },
    default_branch: "main",
    ...overrides,
  };
}

const baseProps = {
  repositories: [] as GitHubRepository[],
  isLoading: false,
  existingProjectIds: new Set<string>(),
  connecting: false,
  onSelect: () => {},
};

describe("RepositoryList", () => {
  it("shows a loading message", () => {
    render(<RepositoryList {...baseProps} isLoading />);
    expect(screen.getByText(/Loading repositories/i)).toBeInTheDocument();
  });

  it("shows an empty message when there are no repositories", () => {
    render(<RepositoryList {...baseProps} />);
    expect(screen.getByText(/No repositories found/i)).toBeInTheDocument();
  });

  it("renders a repository and marks it connected when already added", () => {
    render(
      <RepositoryList
        {...baseProps}
        repositories={[repo()]}
        existingProjectIds={new Set(["1"])}
      />,
    );
    expect(screen.getByText("owner/repo")).toBeInTheDocument();
    expect(screen.getByText(/Already connected/)).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("calls onSelect with the repository when clicked", async () => {
    const onSelect = vi.fn();
    render(<RepositoryList {...baseProps} repositories={[repo()]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("disables rows while connecting", () => {
    render(<RepositoryList {...baseProps} repositories={[repo()]} connecting />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
