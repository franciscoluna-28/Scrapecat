import { getRepositoryById, getRepositoryCommits } from "../../actions/github";
import { redirect } from "next/navigation";
import ReportClientPage from "./client-page";


interface ReportPageProps {
  searchParams: Promise<{ githubId?: string }>;
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { githubId } = await searchParams;
  
  if (!githubId) {
    redirect('/new');
  }

  let commits = [];
  let selectedRepository = null;
  let startDate = '';
  let endDate = '';
  let selectedBranch = '';

  try {
    const repoId = parseInt(githubId, 10);
    
    selectedRepository = await getRepositoryById(repoId);
    
    if (!selectedRepository) {
      console.error('Repository not found:', repoId);
      redirect('/new');
    }

    commits = await getRepositoryCommits(selectedRepository.owner.login, selectedRepository.name, 50);
    
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
    selectedBranch = 'main';
    
  } catch (error) {
    console.error('Failed to fetch repository or commits:', error);
    redirect('/new');
  }

  return (
    <ReportClientPage 
      commits={commits}
      repository={selectedRepository}
      startDate={startDate}
      endDate={endDate}
      branch={selectedBranch}
    />
  );
}
