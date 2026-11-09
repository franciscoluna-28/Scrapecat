import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectProject: vi.fn(),
  openChange: vi.fn(),
  connectRepository: vi.fn(),
  ensureProject: vi.fn(),
}));

vi.mock("@/src/_features/chat/hooks/useSidebarProjects", () => ({
  useSidebarProjects: () => ({
    projectEntries: [
      {
        key: "project-a",
        label: "repo-a",
        projectId: "id-a",
        owner: "acme",
        repositoryName: "repo-a",
        gitProvider: "github",
      },
      {
        key: "project-b",
        label: "repo-b",
        projectId: null,
        owner: "acme",
        repositoryName: "repo-b",
        gitProvider: "github",
        demo: {
          id: "2",
          owner: "acme",
          repo: "repo-b",
          label: "repo-b",
          defaultBranch: "main",
        },
      },
    ],
    isDemo: false,
    ensureProject: mocks.ensureProject,
  }),
}));

import { NewChatDialog } from "./NewChatDialog";

function renderDialog() {
  return render(
    <NewChatDialog
      open
      onOpenChange={mocks.openChange}
      onSelectProject={mocks.selectProject}
      onConnectRepository={mocks.connectRepository}
    />,
  );
}

describe("NewChatDialog", () => {
  beforeEach(() => {
    mocks.selectProject.mockReset();
    mocks.openChange.mockReset();
    mocks.connectRepository.mockReset();
    mocks.ensureProject.mockReset().mockResolvedValue("id-b");
  });

  it("selects a connected project and closes", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();

    await user.click(screen.getByText("acme/repo-a"));

    expect(mocks.selectProject).toHaveBeenCalledWith("id-a");
    expect(mocks.openChange).toHaveBeenCalledWith(false);
  });

  it("creates a demo project before selecting it", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();

    await user.click(screen.getByText("acme/repo-b"));

    expect(mocks.ensureProject).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "repo-b" }),
    );
    expect(mocks.selectProject).toHaveBeenCalledWith("id-b");
  });

  it("filters projects by repository name", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();

    await user.type(screen.getByLabelText("Search projects"), "repo-b");

    expect(screen.queryByText("acme/repo-a")).not.toBeInTheDocument();
    expect(screen.getByText("acme/repo-b")).toBeInTheDocument();
  });

  it("opens the connect-repository flow", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: /connect repository/i }),
    );

    expect(mocks.connectRepository).toHaveBeenCalled();
    expect(mocks.openChange).toHaveBeenCalledWith(false);
  });
});
