"use client";

import { Suspense } from "react";
import { useParams, useSearchParams, notFound } from "next/navigation";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { SettingsForm } from "@/src/_features/reports/components/SettingsForm";
import { RepositoryInfoCard } from "@/src/_features/reports/components/RepositoryInfoCard";
import { useRepositories, useBranches } from "@/src/_features/reports/services/api";
import type { GitHubRepository } from "@/src/shared/types";

function RepoReportPageContent() {
  const params = useParams<{ githubId: string }>();
  const searchParams = useSearchParams();
  const branch = searchParams.get("branch");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const ownerParam = searchParams.get("owner");
  const repoParam = searchParams.get("repo");

  const githubId = params?.githubId;
  if (!githubId) {
    notFound();
  }

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { repositories, isLoading: reposLoading } = useRepositories({
    type: "all",
    sort: "updated",
    direction: "desc",
    per_page: 100,
  });

  const accountRepo =
    (repositories as GitHubRepository[]).find((r) => r.id === githubId) ?? null;

  // The "paste" route is used for arbitrary public repos pasted by URL — the
  // repo is fabricated from the query params and ingested clone-on-demand.
  const isPaste = githubId === "paste" && !!ownerParam && !!repoParam;
  const repository: GitHubRepository | null =
    accountRepo ??
    (isPaste
      ? {
          id: `${ownerParam}/${repoParam}`,
          name: repoParam!,
          full_name: `${ownerParam}/${repoParam}`,
          private: false,
          updated_at: "",
          owner: { login: ownerParam! },
        }
      : null);

  const { branches, defaultBranch } = useBranches(
    repository?.owner.login ?? "",
    repository?.name ?? "",
  );

  if (!reposLoading && !repository) {
    notFound();
  }

  const availableBranches = branches.length > 0 ? branches : [];
  const selectedBranch = branch || defaultBranch || branches[0] || repository?.default_branch || "";

  return (
    <SectionLayout>
      {repository && (
        <>
          <div className="mb-6 flex justify-center">
            <RepositoryInfoCard repository={repository} />
          </div>
          <SettingsForm
            repository={repository}
            branches={availableBranches}
            selectedBranch={selectedBranch}
            startDate={startDate || today}
            endDate={endDate ?? undefined}
          />
        </>
      )}
    </SectionLayout>
  );
}

export default function RepoReportPage() {
  return (
    <Suspense fallback={null}>
      <RepoReportPageContent />
    </Suspense>
  );
}
