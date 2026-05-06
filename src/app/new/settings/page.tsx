import { Suspense } from "react";
import { getRepositoryById, getRepositoryBranches, getRepositoryCommits, GitHubCommit } from "../../../shared/services/github";
import SettingsClientPage from "./client-page";
import SettingsLoading from "./loading";

interface SettingsPageProps {
  searchParams: Promise<{ githubId?: string; branch?: string }>;
}

async function SettingsContent({ searchParams }: { searchParams: Promise<{ githubId?: string; branch?: string; startDate?: string; endDate?: string }> }) {
  const { githubId, branch, startDate, endDate } = await searchParams;
  const MAX_COMMITS = 50;
  const FALLBACK_BRANCHES = ['main', 'dev'];

  let branches: string[] = [];
  let selectedRepository = null;
  let commits: GitHubCommit[] = [];

  if (githubId) {
    const repoId = parseInt(githubId, 10);
    
    selectedRepository = await getRepositoryById(repoId);
    
    if (selectedRepository) {
      try {
        branches = await getRepositoryBranches(selectedRepository.owner.login, selectedRepository.name);
        
        if (branch) {
          commits = await getRepositoryCommits(
            selectedRepository.owner.login, 
            selectedRepository.name, 
            MAX_COMMITS,
            startDate,
            endDate
          );
        }
      } catch (error) {
        console.error('Failed to fetch branches/commits in settings page:', error);
        branches = FALLBACK_BRANCHES;
      }
    }
  }

  return (
    <SettingsClientPage 
      initialBranches={branches}
      initialRepository={selectedRepository}
      initialCommits={commits}
    />
  );
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  );
}
