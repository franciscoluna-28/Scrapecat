"use client";

import { useSearchParams, notFound } from "next/navigation";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { SettingsForm } from "@/src/_features/reports/components/SettingsForm";
import { RepositoryInfoCard } from "@/src/_features/reports/components/RepositoryInfoCard";
import { useRepositories, useBranches } from "@/src/_features/reports/services/api";
import type { GitHubRepository } from "@/src/shared/types";

export default function Page() {
  const searchParams = useSearchParams();
  const githubId = searchParams.get("githubId");
  const branch = searchParams.get("branch");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { repositories, isLoading: reposLoading } = useRepositories({
    type: "all",
    sort: "updated",
    direction: "desc",
    per_page: 100,
  });

  if (!githubId) {
    notFound();
  }

  const repoId = parseInt(githubId, 10);
  const repository = (repositories as GitHubRepository[]).find((r) => r.id === repoId) ?? null;

  const { branches, isLoading: branchesLoading } = useBranches(
    repository?.owner.login ?? "",
    repository?.name ?? "",
  );

  if (!reposLoading && !repository) {
    notFound();
  }

  return (
    <SectionLayout>
      {repository && (
        <>
          <div className="mb-6 flex justify-center">
            <RepositoryInfoCard repository={repository} />
          </div>
          <SettingsForm
            repository={repository}
            branches={branches.length > 0 ? branches : ["main", "master"]}
            selectedBranch={branch || branches[0] || "main"}
            startDate={startDate || today}
            endDate={endDate ?? undefined}
          />
        </>
      )}
    </SectionLayout>
  );
}
