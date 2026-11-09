import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectProject: vi.fn(),
  sendMessage: vi.fn(),
}));

// Force the demo branch of Chat so the welcome cards are rendered.
vi.mock("@/src/shared/constants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/shared/constants")>();
  return { ...actual, IS_DEMO: true };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/src/_features/chat/services/projects-api", () => ({
  useProjects: () => ({ projects: [], isLoading: false }),
}));

vi.mock("@/src/_features/chat/hooks/useChatProject", async () => {
  const { useState } = await import("react");
  return {
    useChatProject: () => {
      const [projectId, setProjectId] = useState<string | null>(null);
      return {
        projectId,
        sessionId: null,
        activeProject: projectId ? "formbricks" : null,
        branches: projectId ? ["main"] : [],
        branch: projectId ? "main" : null,
        defaultBranch: projectId ? "main" : null,
        selectProject: async (demo: { repo: string }) => {
          mocks.selectProject(demo);
          setProjectId(`project-${demo.repo}`);
        },
        changeBranch: vi.fn(),
      };
    },
  };
});

vi.mock("@/src/_features/chat/hooks/useAIChat", async () => {
  const { useState } = await import("react");
  return {
    useAIChat: () => {
      const [input, setInput] = useState("");
      return {
        messages: [],
        messagesLoading: false,
        streamingId: null,
        isStreaming: false,
        isAwaitingResponse: false,
        ingestionProgress: null,
        input,
        setInput,
        sendMessage: (text: string) => {
          mocks.sendMessage(text);
          setInput("");
        },
      };
    },
  };
});

vi.mock("@/src/_features/chat/hooks/useAutoSendPrompt", () => ({
  useAutoSendPrompt: vi.fn(),
}));

vi.mock("@/src/shared/services/ai-models", () => ({
  useAllModels: () => ({ models: [] }),
}));

vi.mock("@/src/shared/services/ai-settings", () => ({
  useAISettings: () => ({ settings: undefined }),
}));

vi.mock("./AddRepositoryDialog", () => ({
  AddRepositoryDialog: () => null,
}));

vi.mock("./NewChatDialog", () => ({
  NewChatDialog: () => null,
}));

import { Chat } from "./Chat";

describe("Chat in demo mode", () => {
  beforeEach(() => {
    mocks.selectProject.mockReset();
    mocks.sendMessage.mockReset();
  });

  it("selects a demo project and starts talking", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Chat />);

    expect(screen.getByText("Welcome to Demo Mode")).toBeInTheDocument();
    expect(screen.getByText("Scrapecat")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /formbricks/i }));

    expect(mocks.selectProject).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "formbricks" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Ask about formbricks")).toBeInTheDocument(),
    );

    const textarea = screen.getByPlaceholderText(
      "Ask about formbricks commits...",
    );
    await user.type(textarea, "What shipped recently?");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(mocks.sendMessage).toHaveBeenCalledWith("What shipped recently?");
  });
});
