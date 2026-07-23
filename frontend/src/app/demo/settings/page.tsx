import { notFound, redirect } from "next/navigation";
import { demoOctokit } from "@/src/shared/lib/demo-octokit";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { PageTitle } from "@/src/components/global/PageTitle";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { DemoForm } from "./form";

interface PageProps {
  searchParams: Promise<{
    owner?: string;
    repo?: string;
    branch?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

async function getRepoInfo(owner: string, repo: string) {
  try {
    const { data } = await demoOctokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    return data;
  } catch {
    return null;
  }
}

async function getRepoBranches(owner: string, repo: string): Promise<string[]> {
  try {
    const { data } = await demoOctokit.request(
      "GET /repos/{owner}/{repo}/branches",
      { owner, repo, per_page: 100 },
    );
    return data.map((b: any) => b.name);
  } catch {
    return ["main", "master"];
  }
}

export default async function Page({ searchParams }: PageProps) {
  const { owner, repo, branch, startDate, endDate } = await searchParams;

  if (!owner || !repo) {
    notFound();
  }

  const repository = await getRepoInfo(owner, repo);

  if (!repository) {
    return (
      <ApplicationLayout>
        <PageTitle title="Repository not found" hasBack />
        <SectionLayout>
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Could not find repository {owner}/{repo}. Make sure it is public
              and the URL is correct.
            </p>
          </div>
        </SectionLayout>
      </ApplicationLayout>
    );
  }

  const branches = await getRepoBranches(owner, repo);

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <ApplicationLayout>
      <PageTitle title={`Configure Report: ${owner}/${repo}`} hasBack />
      <SectionLayout>
        <DemoForm
          owner={owner}
          repo={repo}
          githubProjectId={repository.id}
          branches={branches}
          selectedBranch={branch || branches[0] || "main"}
          defaultStartDate={startDate || today}
          defaultEndDate={endDate}
        />
      </SectionLayout>
    </ApplicationLayout>
  );
}
