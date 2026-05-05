import { create } from 'zustand';
import { GitHubRepository } from '../app/actions/github';

interface FormState {
  selectedRepository: GitHubRepository | null;
  startDate: string;
  endDate: string;
  selectedBranch: string;
  branches: string[];
  
  setSelectedRepository: (repo: GitHubRepository | null) => void;
  setDateRange: (startDate: string, endDate: string) => void;
  setSelectedBranch: (branch: string) => void;
  setBranches: (branches: string[]) => void;
  clearSelection: () => void;
  resetForm: () => void;
}

export const useFormStore = create<FormState>((set) => ({
  selectedRepository: null,
  startDate: '',
  endDate: '',
  selectedBranch: '',
  branches: [],

  setSelectedRepository: (repo) => set({ selectedRepository: repo }),
  setDateRange: (startDate, endDate) => set({ startDate, endDate }),
  setSelectedBranch: (branch) => set({ selectedBranch: branch }),
  setBranches: (branches) => set({ branches }),
  clearSelection: () => set({ selectedRepository: null }),
  resetForm: () => set({ 
    selectedRepository: null, 
    startDate: '', 
    endDate: '', 
    selectedBranch: '', 
    branches: [] 
  }),
}));
