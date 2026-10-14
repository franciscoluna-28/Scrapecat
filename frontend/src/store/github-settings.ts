import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  GITHUB_PER_PAGE,
  type RepositoryType,
  type SortType,
  type DirectionType,
} from '@/src/shared/constants'

interface GitHubSettingsState {
  repositoryType: RepositoryType
  perPage: number
  sort: SortType
  direction: DirectionType
  setRepositoryType: (type: RepositoryType) => void
  setPerPage: (perPage: number) => void
  setSort: (sort: SortType) => void
  setDirection: (direction: DirectionType) => void
}

export const useGitHubSettingsStore = create<GitHubSettingsState>()(
  persist(
    (set, _get) => ({
      repositoryType: 'all',
      perPage: GITHUB_PER_PAGE.default,
      sort: 'updated',
      direction: 'desc',
      setRepositoryType: (repositoryType) => set({ repositoryType }),
      setPerPage: (perPage) => set({ perPage }),
      setSort: (sort) => set({ sort }),
      setDirection: (direction) => set({ direction }),
    }),
    {
      name: 'github-settings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
