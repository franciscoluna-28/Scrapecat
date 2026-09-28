import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ChatModelState {
  provider: string | null;
  model: string | null;
  setModel: (provider: string, model: string) => void;
  clearModel: () => void;
}

export const useChatModelStore = create<ChatModelState>()(
  persist(
    (set) => ({
      provider: null,
      model: null,
      setModel: (provider, model) => set({ provider, model }),
      clearModel: () => set({ provider: null, model: null }),
    }),
    {
      name: 'chat-model',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
