import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import { DEFAULT_TONE_PRESETS } from "../shared/constants";

export type PromptPreset = {
  id: string;
  name: string;
  prompt: string;
};

interface PromptPresetsState {
  presets: PromptPreset[];
  addPreset: (name: string, prompt: string) => void;
  deletePreset: (id: string) => void;
}

export const usePromptPresetsStore = create<PromptPresetsState>()(
  persist(
    (set) => ({
      presets: [],
      addPreset: (name, prompt) =>
        set((state) => ({
          presets: [...state.presets, { id: nanoid(), name, prompt }],
        })),
      deletePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
        })),
    }),
    {
      name: "prompt-presets",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, initial) => {
        if (persisted) {
          return { ...initial, ...(persisted as Partial<PromptPresetsState>) };
        }
        return {
          ...initial,
          presets: DEFAULT_TONE_PRESETS.map((p) => ({ id: nanoid(), ...p })),
        };
      },
    },
  ),
);
