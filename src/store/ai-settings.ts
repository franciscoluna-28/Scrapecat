import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AISettingsState {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      selectedModel: DEFAULT_MODEL,
      setSelectedModel: (selectedModel) => set({ selectedModel }),
    }),
    {
      name: "ai-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
