"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/src/shared/api/client";
import { useCreateProject, useProjects } from "@/src/_features/chat/services/projects-api";
import {
  IS_DEMO,
  DEMO_PROJECTS,
  DEMO_DEFAULT_REPO,
  type DemoProject,
} from "@/src/shared/constants";

export type DemoProjectEntry = DemoProject & { projectId: string | null };

/**
 * Demo-only helper for the fixed demo repositories. Resolves each configured
 * demo repo to its database project (if it has been ingested yet) and can
 * create it on demand via the same endpoint the "connect repository" flow uses.
 */
export function useDemoProjects() {
  const { mutateAsync: createProject } = useCreateProject();
  const { projects } = useProjects();

  const findProject = useCallback(
    (demo: DemoProject) =>
      projects.find(
        (p) => p.providerOwner === demo.owner && p.repositoryName === demo.repo,
      ) ?? null,
    [projects],
  );

  const demoProjects = useMemo<DemoProjectEntry[]>(
    () =>
      IS_DEMO
        ? DEMO_PROJECTS.map((demo) => ({
            ...demo,
            projectId: findProject(demo)?.id ?? null,
          }))
        : [],
    [findProject],
  );

  const defaultProject = useMemo(
    () => DEMO_PROJECTS.find((p) => p.repo === DEMO_DEFAULT_REPO) ?? DEMO_PROJECTS[0],
    [],
  );

  const ensureProject = useCallback(
    async (demo: DemoProject): Promise<string | null> => {
      const existing = findProject(demo);
      if (existing) return existing.id;

      try {
        const project = await createProject({
          gitProvider: "github",
          providerProjectId: demo.id,
          providerOwner: demo.owner,
          repositoryName: demo.repo,
          defaultBranch: demo.defaultBranch,
        });

        return project.id;
      } catch (error) {
        toast.error(errorMessage(error, "Failed to open demo project"));
        return null;
      }
    },
    [createProject, findProject],
  );

  return { isDemo: IS_DEMO, demoProjects, defaultProject, ensureProject };
}
