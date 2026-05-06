import { create } from 'zustand';
import { GitHubRepository } from '../types';


interface FormState {
  selectedRepository: GitHubRepository | null;
  startDate: string;
  endDate: string;
  selectedBranch: string;
  branches: string[];
  isLoading: boolean;
  
  setSelectedRepository: (repo: GitHubRepository | null) => void;
  setDateRange: (startDate: string, endDate: string) => void;
  setSelectedBranch: (branch: string) => void;
  setBranches: (branches: string[]) => void;
  setIsLoading: (loading: boolean) => void;
  clearSelection: () => void;
  resetForm: () => void;
}

export const useFormStore = create<FormState>((set) => ({
  selectedRepository: null,
  startDate: '',
  endDate: '',
  selectedBranch: '',
  branches: [],
  isLoading: false,

  setSelectedRepository: (repo) => set({ selectedRepository: repo }),
  setDateRange: (startDate, endDate) => set({ startDate, endDate }),
  setSelectedBranch: (branch) => set({ selectedBranch: branch }),
  setBranches: (branches) => set({ branches }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  clearSelection: () => set({ selectedRepository: null }),
  resetForm: () => set({ 
    selectedRepository: null, 
    startDate: '', 
    endDate: '', 
    selectedBranch: '', 
    branches: [],
    isLoading: false 
  }),
}));
