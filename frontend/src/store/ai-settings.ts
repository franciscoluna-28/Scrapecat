import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PROVIDERS } from "../shared/constants";


export type ProviderId = (typeof PROVIDERS)[number]["id"];

interface AISettingsState {
  selectedProvider: ProviderId;
  selectedModel: string;
  setSelectedProvider: (provider: ProviderId) => void;
  setSelectedModel: (model: string) => void;
}

const DEFAULT_PROVIDER: ProviderId = "openrouter";
const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      selectedProvider: DEFAULT_PROVIDER,
      selectedModel: DEFAULT_MODEL,
      setSelectedProvider: (selectedProvider) => set({ selectedProvider }),
      setSelectedModel: (selectedModel) => set({ selectedModel }),
    }),
    {
      name: "ai-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
