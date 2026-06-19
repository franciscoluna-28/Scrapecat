"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Card, CardContent } from "@/src/components/ui/card";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { GitBranch, Settings, FileText } from "lucide-react";
import { RepositoryCard } from "@/src/features/reports/components/RepositoryCard";
import { PageTitle } from "@/src/components/global/PageTitle";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { Button } from "@/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useGitHubSettingsStore } from "@/src/store/github-settings";
import { GitHubSettingsModal } from "@/src/components/GitHubSettingsModal";
import { useRepositories } from "@/src/features/reports/services/api";
import { useReports } from "@/src/features/reports/services/reports-api";
import { GitHubRepository } from "@/src/shared/types";
import { ReportCard } from "@/src/features/reports/components/ReportCard";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = searchParams.get('view') === 'reports' ? 'reports' : 'repositories';

  const { repositoryType, perPage, sort, direction } = useGitHubSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);

  const { repositories, isFetching: isFetchingRepos, hasError: hasReposError } = useRepositories({
    type: repositoryType,
    sort,
    direction,
    per_page: perPage,
  });

  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const { reports, distinctProjects, isFetching: isFetchingReports, hasError: hasReportsError } = useReports(selectedProject);

  return (
    <>
      <ApplicationLayout>
        <PageTitle title="Select Repository or Report" />
        <SectionLayout>
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeView === 'repositories' ? 'default' : 'outline'}
              onClick={() => router.replace('/new?view=repositories')}
              className="flex-1"
            >
              <GitBranch className="mr-2 h-4 w-4" />
              Repositories
            </Button>
            <Button
              variant={activeView === 'reports' ? 'default' : 'outline'}
              onClick={() => router.replace('/new?view=reports')}
              className="flex-1"
            >
              <FileText className="mr-2 h-4 w-4" />
              Available Reports
            </Button>
          </div>

          {activeView === 'repositories' && (
            <>
              <div className="flex justify-center mb-4">
                <Button variant="outline" onClick={() => setModalOpen(true)}>
                  <Settings className="mr-2" /> Repositories Settings
                </Button>
              </div>
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
            </>
          )}

          {activeView === 'reports' && (
            <>
              {distinctProjects.length > 0 && (
                <div className="flex justify-center mb-4">
                  <Select
                    value={selectedProject ?? "all"}
                    onValueChange={(value) =>
                      setSelectedProject(value === "all" ? undefined : value)
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {distinctProjects.map((project) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
            </>
          )}
        </SectionLayout>
      </ApplicationLayout>

      <GitHubSettingsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
