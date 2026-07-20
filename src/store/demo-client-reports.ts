import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type DemoCommit = {
  sha: string;
  message: string;
  author: string;
  url?: string;
  date: string;
};

export type ClientReport = {
  id: string;
  githubProjectId: number;
  githubRepositoryName: string;
  originalMarkdown: string;
  editableMarkdown: string;
  startDate: string;
  endDate: string;
  branch: string;
  commits: DemoCommit[];
  createdAt: string;
  updatedAt: string;
};

interface DemoClientReportsState {
  reports: ClientReport[];
  addReport: (report: ClientReport) => void;
  updateReport: (id: string, data: { editableMarkdown: string }) => void;
  getReport: (id: string) => ClientReport | undefined;
}

export const useDemoClientReportsStore = create<DemoClientReportsState>()(
  persist(
    (set, get) => ({
      reports: [],
      addReport: (report) =>
        set((state) => ({
          reports: [report, ...state.reports],
        })),
      updateReport: (id, data) =>
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id
              ? { ...r, ...data, updatedAt: new Date().toISOString() }
              : r,
          ),
        })),
      getReport: (id) => get().reports.find((r) => r.id === id),
    }),
    {
      name: "demo-reports",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
