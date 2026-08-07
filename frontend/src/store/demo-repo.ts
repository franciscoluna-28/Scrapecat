import { create } from "zustand";

interface DemoRepoState {
  url: string;
  owner: string;
  repo: string;
  setUrl: (url: string) => void;
  setRepo: (owner: string, repo: string) => void;
  reset: () => void;
}

export const useDemoRepoStore = create<DemoRepoState>((set) => ({
  url: "",
  owner: "",
  repo: "",
  setUrl: (url) => set({ url }),
  setRepo: (owner, repo) => set({ owner, repo }),
  reset: () => set({ url: "", owner: "", repo: "" }),
}));
