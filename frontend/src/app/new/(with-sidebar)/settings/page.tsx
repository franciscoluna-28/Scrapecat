import { notFound } from "next/navigation";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { SettingsForm } from "@/src/features/reports/components/SettingsForm";
import { RepositoryInfoCard } from "@/src/features/reports/components/RepositoryInfoCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PageProps {
  searchParams: Promise<{
    githubId?: string;
    branch?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

async function fetchRepositoryById(repoId: number) {
  const res = await fetch(`${API_URL}/api/repositories?per_page=100`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const repos = await res.json();
  return repos.find((r: any) => r.id === repoId) || null;
}

async function fetchRepositoryBranches(owner: string, repo: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/branches?owner=${owner}&repo=${repo}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return ["main", "master"];
    const data = await res.json();
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
