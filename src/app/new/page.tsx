"use client";

import { useState } from "react";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Card, CardContent } from "@/src/components/ui/card";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { GitBranch, Settings, FileText } from "lucide-react";
import { RepositoryCard } from "@/src/features/reports/components/RepositoryCard";
import { PageTitle } from "@/src/components/global/PageTitle";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { Button } from "@/src/components/ui/button";
import { useGitHubSettingsStore } from "@/src/store/github-settings";
import { GitHubSettingsModal } from "@/src/components/GitHubSettingsModal";
import { useRepositories } from "@/src/features/reports/services/api";
import { useReports } from "@/src/features/reports/services/reports-api";
import { GitHubRepository } from "@/src/shared/types";
import { ReportCard } from "@/src/features/reports/components/ReportCard";

export default function Page() {
  const { repositoryType, perPage, sort, direction } = useGitHubSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'repositories' | 'reports'>('repositories');

  const { repositories, isFetching: isFetchingRepos, hasError: hasReposError } = useRepositories({
    type: repositoryType,
    sort,
    direction,
    per_page: perPage,
  });

  const { reports, isFetching: isFetchingReports, hasError: hasReportsError } = useReports();

  return (
    <>
      <ApplicationLayout>
        <PageTitle title="Select Repository or Report">
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <Settings className="mr-2" /> GitHub Settings
          </Button>
        </PageTitle>
        <SectionLayout>
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeView === 'repositories' ? 'default' : 'outline'}
              onClick={() => setActiveView('repositories')}
              className="flex-1"
            >
              <GitBranch className="mr-2 h-4 w-4" />
              Repositories
            </Button>
            <Button
              variant={activeView === 'reports' ? 'default' : 'outline'}
              onClick={() => setActiveView('reports')}
              className="flex-1"
            >
              <FileText className="mr-2 h-4 w-4" />
              Available Reports
            </Button>
          </div>

          {activeView === 'repositories' && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <ScrollArea className="h-[70vh]">
                  <div className="p-6 space-y-2">
                      {isFetchingRepos ? (
                  <div className="text-center py-12">
                    <GitBranch className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                    <h3 className="text-lg font-medium mb-2">
                      Loading repositories...
                    </h3>
                  </div>
                      ) : hasReposError ? (
                  <div className="text-center py-12">
                    <GitBranch className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Failed to load repositories
                    </h3>
                    <p className="text-muted-foreground">
                      Check your connection and GITHUB_TOKEN configuration.
                    </p>
                  </div>
                ) : repositories.length === 0 ? (
                  <div className="text-center py-12">
                    <GitBranch className="h-12 w-12 text-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No repositories found
                    </h3>
                    <p className="text-muted-foreground">
                      Ensure your GITHUB_TOKEN has access to your repositories
                      and is properly configured.
                    </p>
                  </div>
                ) : (
                  repositories.map((repo: GitHubRepository) => (
                    <RepositoryCard key={repo.id} repository={repo} />
                  ))
                )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {activeView === 'reports' && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <ScrollArea className="h-[70vh]">
                  <div className="p-6 space-y-2">
                      {isFetchingReports ? (
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                          <h3 className="text-lg font-medium mb-2">
                            Loading reports...
                          </h3>
                        </div>
                      ) : hasReportsError ? (
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 text-red-500 mx-auto mb-4" />
                          <h3 className="text-lg font-medium mb-2">
                            Failed to load reports
                          </h3>
                          <p className="text-muted-foreground">
                            Unable to fetch reports from the database.
                          </p>
                        </div>
                      ) : reports.length === 0 ? (
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 text-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium mb-2">
                            No reports found
                          </h3>
                          <p className="text-muted-foreground">
                            Generate your first report from a repository settings page.
                          </p>
                        </div>
                      ) : (
                        reports.map((report) => (
                          <ReportCard key={report.id} report={report} />
                        ))
                      )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </SectionLayout>
      </ApplicationLayout>

      <GitHubSettingsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
