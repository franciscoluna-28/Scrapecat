import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_PERSONA, type Persona } from "@/src/shared/constants";

interface ChatPersonaState {
  persona: Persona;
  setPersona: (persona: Persona) => void;
}

export const useChatPersonaStore = create<ChatPersonaState>()(
  persist(
    (set) => ({
      persona: DEFAULT_PERSONA,
      setPersona: (persona) => set({ persona }),
    }),
    {
      name: "chat-persona",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
