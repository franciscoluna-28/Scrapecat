import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ChatBranchState {
  branches: Record<string, string>;
  setBranch: (projectId: string, branch: string) => void;
}

export const useChatBranchStore = create<ChatBranchState>()(
  persist(
    (set) => ({
      branches: {},
      setBranch: (projectId, branch) =>
        set((state) => ({
          branches: { ...state.branches, [projectId]: branch },
        })),
    }),
    {
      name: 'chat-branch',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
