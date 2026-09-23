import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ChatBranchState {
  branches: Record<string, string>;
  getBranch: (projectId: string, defaultBranch: string | null) => string;
  setBranch: (projectId: string, branch: string) => void;
}

export const useChatBranchStore = create<ChatBranchState>()(
  persist(
    (set, get) => ({
      branches: {},
      getBranch: (projectId, defaultBranch) => {
        const stored = get().branches[projectId];
        return stored ?? defaultBranch ?? '';
      },
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
