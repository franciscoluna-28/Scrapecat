"use client";

import { useMemo } from "react";
import {
  useDemoProjects,
  type DemoProjectEntry,
} from "@/src/_features/demo/hooks/useDemoProjects";
import { useProjects } from "@/src/_features/chat/services/projects-api";

export type SidebarProjectEntry = {
  key: string;
  label: string;
  projectId: string | null;
  demo?: DemoProjectEntry;
};

/**
 * Merges the fixed demo repositories (when in demo mode) with the visitor's
 * synced projects, keeping stable keys and dropping duplicates.
 */
export function useSidebarProjects() {
  const { projects, isLoading } = useProjects();
  const { isDemo, demoProjects, ensureProject } = useDemoProjects();

  const projectEntries = useMemo<SidebarProjectEntry[]>(() => {
    const fixedDemoIds = new Set(
      demoProjects.map((d) => d.projectId).filter((id): id is string => !!id),
    );

    return [
      ...(isDemo
        ? demoProjects.map((d) => ({
            key: `${d.owner}/${d.repo}`,
            label: d.label,
            projectId: d.projectId,
            demo: d,
          }))
        : []),
      ...projects
        .filter((p) => !fixedDemoIds.has(p.id))
        .map((p) => ({ key: p.id, label: p.repositoryName, projectId: p.id })),
    ];
  }, [isDemo, demoProjects, projects]);

  return { projectEntries, isLoading, isDemo, ensureProject };
}
