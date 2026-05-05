import { Suspense } from "react";
import { getRepositoryById, getRepositoryBranches } from "../../actions/github";
import SettingsClientPage from "./client-page";
import SettingsLoading from "./loading";

interface SettingsPageProps {
  searchParams: Promise<{ githubId?: string }>;
}

async function SettingsContent({ searchParams }: { searchParams: Promise<{ githubId?: string }> }) {
  const { githubId } = await searchParams;
  
  let branches: string[] = [];
  let selectedRepository = null;

  if (githubId) {
    const repoId = parseInt(githubId, 10);
    
    selectedRepository = await getRepositoryById(repoId);
    
    if (selectedRepository) {
      try {
        branches = await getRepositoryBranches(selectedRepository.owner.login, selectedRepository.name);
      } catch (error) {
        console.error('Failed to fetch branches in settings page:', error);
        branches = ['main', 'dev'];
      }
    }
  }

  return (
    <SettingsClientPage 
      repositories={selectedRepository ? [selectedRepository] : []} 
      initialBranches={branches}
      initialRepository={selectedRepository}
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
