import { notFound } from "next/navigation";
import {
  getRepositoryById,
  getRepositoryBranches,
} from "@/src/shared/services/github";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { SettingsForm } from "@/src/features/reports/components/SettingsForm";
import { RepositoryInfoCard } from "@/src/features/reports/components/RepositoryInfoCard";

interface PageProps {
  searchParams: Promise<{
    githubId?: string;
    branch?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { githubId, branch, startDate, endDate } = await searchParams;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (!githubId) {
    notFound();
  }

  const repoId = parseInt(githubId, 10);
  const repository = await getRepositoryById(repoId);

  if (!repository) {
    notFound();
  }

  const branches = await getRepositoryBranches(
    repository.owner.login,
    repository.name,
  ).catch(() => ["main", "master"]);

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
