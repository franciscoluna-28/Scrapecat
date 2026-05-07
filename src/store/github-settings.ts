import { create } from 'zustand';

type RepositoryType = 'all' | 'owner' | 'public' | 'private';
type SortType = 'created' | 'updated' | 'pushed' | 'full_name';
type DirectionType = 'asc' | 'desc';

interface GitHubSettingsState {
  repositoryType: RepositoryType;
  perPage: number;
  sort: SortType;
  direction: DirectionType;
  setRepositoryType: (type: RepositoryType) => void;
  setPerPage: (perPage: number) => void;
  setSort: (sort: SortType) => void;
  setDirection: (direction: DirectionType) => void;
}

export const useGitHubSettingsStore = create<GitHubSettingsState>((set) => ({
  repositoryType: 'all',
  perPage: 10,
  sort: 'updated',
  direction: 'desc',
  setRepositoryType: (repositoryType) => set({ repositoryType }),
  setPerPage: (perPage) => set({ perPage }),
  setSort: (sort) => set({ sort }),
  setDirection: (direction) => set({ direction }),
}));
