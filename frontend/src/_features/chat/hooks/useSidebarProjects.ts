"use client";

import { useMemo } from "react";
import {
  useDemoProjects,
  type DemoProjectEntry,
} from "@/src/_features/demo/hooks/useDemoProjects";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import type { GitProviderId } from "@/src/shared/constants";

export type SidebarProjectEntry = {
  key: string;
  label: string;
  projectId: string | null;
  owner: string;
  repositoryName: string;
  gitProvider: GitProviderId;
  demo?: DemoProjectEntry;
};

/**
 * Merges the fixed demo repositories (when in demo mode) with the visitor's
 * synced projects, keeping stable keys and dropping duplicates.
 */
export function useSidebarProjects() {
  const { projects } = useProjects();
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
            owner: d.owner,
            repositoryName: d.repo,
            gitProvider: "github" as const,
            demo: d,
          }))
        : []),
      ...projects
        .filter((p) => !fixedDemoIds.has(p.id))
        .map((p) => ({
          key: p.id,
          label: p.repositoryName,
          projectId: p.id,
          owner: p.providerOwner,
          repositoryName: p.repositoryName,
          gitProvider: p.gitProvider,
        })),
    ];
  }, [isDemo, demoProjects, projects]);

  return { projectEntries, isDemo, ensureProject };
}
