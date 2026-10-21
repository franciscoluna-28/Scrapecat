"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import { parseRepoUrl } from "@/src/shared/utils/repo-url";
import { useRepositories } from "@/src/_features/git-providers/services/git-providers-api";
import {
  GIT_PROVIDER_META,
  type GitProviderId,
} from "@/src/shared/constants";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import type { GitProviderRepository } from "@/src/shared/types";

type ConnectParams = {
  providerProjectId: string;
  providerOwner: string;
  repositoryName: string;
  defaultBranch: string;
  label: string;
};

export function useAddRepository(
  onProjectSelected: (projectId: string) => void,
  provider: GitProviderId = "github",
) {
  const queryClient = useQueryClient();
  const { repositories, isFetching } = useRepositories({
    provider,
    type: "all",
    sort: "updated",
    direction: "desc",
    per_page: 50,
  });
  const { projects } = useProjects();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const existingProjectIds = new Set(
    projects.map((p) => p.providerProjectId),
  );

  const handleValueChange = (next: string) => {
    setValue(next);
    setError(null);
  };

  const connect = async ({
    providerProjectId,
    providerOwner,
    repositoryName,
    defaultBranch,
    label,
  }: ConnectParams) => {
    const existing = projects.find(
      (p) =>
        p.gitProvider === provider &&
        p.providerOwner === providerOwner &&
        p.repositoryName === repositoryName,
    );
    if (existing) {
      onProjectSelected(existing.id);
      setOpen(false);
      toast.success(`Switched to ${label}`);
      return;
    }

    setConnecting(true);
    try {
      const res = await apiClient.POST("/api/v1/projects", {
        body: {
          gitProvider: provider,
          providerProjectId,
          providerOwner,
          repositoryName,
          defaultBranch,
        },
      });
      if (res.error || !res.data) {
        toast.error("Failed to connect repository");
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.projects.list,
      });

      onProjectSelected(res.data.id);
      setOpen(false);
      toast.success(`Connected to ${label}`);
    } finally {
      setConnecting(false);
    }
  };

  // Use the provider's numeric repo id as the external id — the backend also
  // canonicalizes every creation path to it, so the same repo always resolves
  // to one project row (ingestion + embeddings run once).
  const connectByRepo = (repo: GitProviderRepository) =>
    connect({
      providerProjectId: repo.id,
      providerOwner: repo.owner.login,
      repositoryName: repo.name,
      defaultBranch: repo.default_branch ?? "main",
      label: repo.name,
    });

  const connectByUrl = async () => {
    const parsed = parseRepoUrl(value);
    if (!parsed) {
      setError(
        `Enter a valid ${GIT_PROVIDER_META[provider].label} URL or owner/repo`,
      );
      return;
    }
    setValue("");
    setError(null);

    await connect({
      providerProjectId: `${parsed.owner}/${parsed.repo}`,
      providerOwner: parsed.owner,
      repositoryName: parsed.repo,
      defaultBranch: "main",
      label: `${parsed.owner}/${parsed.repo}`,
    });
  };

  return {
    open,
    setOpen,
    value,
    onValueChange: handleValueChange,
    error,
    connecting,
    repositories,
    isFetching,
    existingProjectIds,
    connectByRepo,
    connectByUrl,
  };
}
