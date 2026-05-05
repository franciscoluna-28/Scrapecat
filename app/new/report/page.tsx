import { getRepositoryById, getRepositoryCommits } from "../../actions/github";
import { generateCommitReport, generateExecutiveSummary } from "../../actions/ai";
import ReportClientPage from "./client-page";
interface ReportPageProps {
  searchParams: Promise<{ githubId?: string }>;
}

// TODO: Fix error handling and validation to ensure githubId is valid and repository exists
export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { githubId } = await searchParams;

  let commits = [];
  let selectedRepository = null;
  let startDate = '';
  let endDate = '';
  let selectedBranch = '';

  try {
    const repoId = parseInt(githubId || '0', 10);
    
    selectedRepository = await getRepositoryById(repoId);
    

    commits = await getRepositoryCommits(selectedRepository?.owner.login || '', selectedRepository?.name || '', 50);
    
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
    selectedBranch = 'main';
    
    // Generate AI reports
    const reportData = {
      repository: selectedRepository?.name || '',
      branch: selectedBranch,
      startDate,
      endDate,
      commits: commits.map(commit => ({
        sha: commit.sha || '',
        message: commit.commit?.message || 'No message',
        author: commit.commit?.author?.name || 'Unknown',
        date: commit.commit?.author?.date || new Date().toISOString(),
        url: commit.html_url || ''
      }))
    };

    const technicalReport = await generateCommitReport(reportData);
    const executiveSummary = await generateExecutiveSummary(reportData);
    
    return (
      <ReportClientPage 
        commits={commits}
        repository={selectedRepository}
        startDate={startDate}
        endDate={endDate}
        branch={selectedBranch}
        technicalReport={technicalReport}
        executiveSummary={executiveSummary}
      />
    );
    
  } catch (error) {
    console.error('Failed to fetch repository or commits:', error);
    // TODO: Handle error properly with error boundaries
  }
}
