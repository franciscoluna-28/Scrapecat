import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAISettings: vi.fn(),
  update: vi.fn(),
  useModels: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/src/shared/services/ai-settings", () => ({
  useAISettings: () => mocks.useAISettings(),
  useUpdateAISettings: () => ({ mutateAsync: mocks.update, isPending: false }),
}));

vi.mock("@/src/shared/services/ai-models", () => ({
  useModels: () => mocks.useModels(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("./AISettingsCard", async () => {
  const { createElement } = await import("react");
  return {
    AISettingsCard: (props: {
      embeddingProvider: string;
      embeddingModel: string;
      dirty: boolean;
      setEmbeddingModel: (value: string) => void;
      onSave: () => void;
    }) =>
      createElement(
        "div",
        null,
        createElement("span", { "data-testid": "provider" }, props.embeddingProvider),
        createElement("span", { "data-testid": "model" }, props.embeddingModel),
        createElement("span", { "data-testid": "dirty" }, String(props.dirty)),
        createElement(
          "button",
          { onClick: () => props.setEmbeddingModel("new-model") },
          "change-model",
        ),
        createElement("button", { onClick: props.onSave }, "save"),
      ),
  };
});

import { AISettingsManager } from "./AISettingsManager";

const settings = {
  chatProvider: "openrouter",
  chatModel: "chat-model",
  embeddingProvider: "openrouter",
  embeddingModel: "old-model",
} as const;

beforeEach(() => {
  mocks.useAISettings.mockReset();
  mocks.update.mockReset();
  mocks.useModels.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.useModels.mockReturnValue({ models: [], isLoading: false });
});

describe("AISettingsManager", () => {
  it("renders skeletons while settings load", () => {
    mocks.useAISettings.mockReturnValue({
      settings: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<AISettingsManager />);

    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("renders the load error message", () => {
    mocks.useAISettings.mockReturnValue({
      settings: undefined,
      isLoading: false,
      error: new Error("load failed"),
    });

    render(<AISettingsManager />);

    expect(screen.getByText("load failed")).toBeInTheDocument();
  });

  it("requires an embedding model before saving", async () => {
    mocks.useAISettings.mockReturnValue({
      settings: { ...settings, embeddingModel: "" },
      isLoading: false,
      error: null,
    });

    render(<AISettingsManager />);
    fireEvent.click(screen.getByText("save"));

    expect(mocks.toastError).toHaveBeenCalledWith("Select an embedding model");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("saves the edited embedding model", async () => {
    mocks.useAISettings.mockReturnValue({
      settings,
      isLoading: false,
      error: null,
    });
    mocks.update.mockResolvedValue(undefined);

    render(<AISettingsManager />);

    fireEvent.click(screen.getByText("change-model"));
    expect(screen.getByTestId("model")).toHaveTextContent("new-model");
    expect(screen.getByTestId("dirty")).toHaveTextContent("true");

    await act(async () => {
      fireEvent.click(screen.getByText("save"));
    });

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        ...settings,
        embeddingModel: "new-model",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Embedding settings saved");
  });

  it("surfaces save failures through a toast", async () => {
    mocks.useAISettings.mockReturnValue({
      settings,
      isLoading: false,
      error: null,
    });
    mocks.update.mockRejectedValue(new Error("save failed"));

    render(<AISettingsManager />);

    fireEvent.click(screen.getByText("change-model"));
    await act(async () => {
      fireEvent.click(screen.getByText("save"));
    });

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("save failed"),
    );
  });
});
