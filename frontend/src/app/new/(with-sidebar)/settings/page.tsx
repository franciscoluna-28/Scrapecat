import { notFound } from "next/navigation";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { SettingsForm } from "@/src/features/reports/components/SettingsForm";
import { RepositoryInfoCard } from "@/src/features/reports/components/RepositoryInfoCard";
import { apiClient } from "@/src/shared/api/client";
import type { GitHubRepository } from "@/src/shared/types";

interface PageProps {
  searchParams: Promise<{
    githubId?: string;
    branch?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

async function fetchRepositoryById(repoId: number): Promise<GitHubRepository | null> {
  const { data, error } = await apiClient.GET("/api/v1/repositories", {
    params: { query: { per_page: "100" } },
  });
  if (error || !data) return null;
  return (data as GitHubRepository[]).find((r) => r.id === repoId) || null;
}

async function fetchRepositoryBranches(owner: string, repo: string): Promise<string[]> {
  try {
    const { data, error } = await apiClient.GET("/api/v1/repositories/{owner}/{repo}/branches", {
      params: { path: { owner, repo } },
    });
    if (error || !data) return ["main", "master"];
    return data.branches || ["main", "master"];
  } catch {
    return ["main", "master"];
  }
}

export default async function Page({ searchParams }: PageProps) {
  const { githubId, branch, startDate, endDate } = await searchParams;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (!githubId) {
    notFound();
  }

  const repoId = parseInt(githubId, 10);
  const repository = await fetchRepositoryById(repoId);

  if (!repository) {
    notFound();
  }

  const branches = await fetchRepositoryBranches(
    repository.owner.login,
    repository.name,
  );

  return (
    <SectionLayout>
      <div className="mb-6 flex justify-center">
        <RepositoryInfoCard repository={repository} />
      </div>
      <SettingsForm
        repository={repository}
        branches={branches}
        selectedBranch={branch || branches[0] || "main"}
        startDate={startDate || today}
        endDate={endDate}
      />
    </SectionLayout>
  );
}
