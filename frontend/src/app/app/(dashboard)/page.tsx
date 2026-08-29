"use client";

import { GitBranch } from "lucide-react";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Card, CardContent } from "@/src/components/ui/card";
import { RepositoryCard } from "@/src/_features/reports/components/RepositoryCard";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { RecentProjectsSection } from "@/src/_features/reports/components/RecentProjectsSection";
import { useGitHubSettingsStore } from "@/src/store/github-settings";
import { useRepositories } from "@/src/_features/reports/services/api";
import { GitHubRepository } from "@/src/shared/types";

export default function RepositoriesPage() {
  const {
    repositoryType,
    perPage,
    sort,
    direction,
  } = useGitHubSettingsStore();

  const { repositories, isFetching: isFetchingRepos, hasError: hasReposError } = useRepositories({
    type: repositoryType,
    sort,
    direction,
    per_page: perPage,
  });

  return (
    <SectionLayout>
      <RecentProjectsSection />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="h-[70vh]">
            <div className="p-6 space-y-2">
              {isFetchingRepos ? (
                <div className="text-center py-12">
                  <GitBranch className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                  <h3 className="text-lg font-medium mb-2">Loading repositories...</h3>
                </div>
              ) : hasReposError ? (
                <div className="text-center py-12">
                  <GitBranch className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Failed to load repositories</h3>
                  <p className="text-muted-foreground">Check your connection and GITHUB_TOKEN configuration.</p>
                </div>
              ) : repositories.length === 0 ? (
                <div className="text-center py-12">
                  <GitBranch className="h-12 w-12 text-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No repositories found</h3>
                  <p className="text-muted-foreground">Ensure your GITHUB_TOKEN has access to your repositories.</p>
                </div>
              ) : (
                (repositories as GitHubRepository[]).map((repo) => (
                  <RepositoryCard key={repo.id} repository={repo} />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </SectionLayout>
  );
}
