"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Card, CardContent } from "@/src/components/ui/card";
import { GitBranch, FileText } from "lucide-react";
import { RepositoryCard } from "@/src/_features/reports/components/RepositoryCard";
import { CredentialsManager } from "@/src/_features/credentials/components/CredentialsManager";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Label } from "@/src/components/ui/label";
import { Input } from "@/src/components/ui/input";
import { useGitHubSettingsStore } from "@/src/store/github-settings";
import { useRepositories } from "@/src/_features/reports/services/api";
import { useReports } from "@/src/_features/reports/services/reports-api";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { GitHubRepository } from "@/src/shared/types";
import { ReportCard } from "@/src/_features/reports/components/ReportCard";

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") || "repositories";

  const {
    repositoryType, perPage, sort, direction,
    setRepositoryType, setPerPage, setSort, setDirection,
  } = useGitHubSettingsStore();

  const { repositories, isFetching: isFetchingRepos, hasError: hasReposError } = useRepositories({
    type: repositoryType,
    sort,
    direction,
    per_page: perPage,
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const { reports, isFetching: isFetchingReports, hasError: hasReportsError } = useReports(selectedProjectId);
  const { projects } = useProjects();

  return (
    <SectionLayout>
      {activeView === "repositories" && (
        <>
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
        </>
      )}

      {activeView === "reports" && (
        <>
          {projects.length > 0 && (
            <div className="flex justify-center mb-4">
              <Select
                value={selectedProjectId ?? "all"}
                onValueChange={(value) =>
                  setSelectedProjectId(value === "all" ? undefined : value)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.repositoryName}
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
                      <h3 className="text-lg font-medium mb-2">Loading reports...</h3>
                    </div>
                  ) : hasReportsError ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Failed to load reports</h3>
                      <p className="text-muted-foreground">Unable to fetch reports from the database.</p>
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No reports found</h3>
                      <p className="text-muted-foreground">Generate your first report from a repository settings page.</p>
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

      {activeView === "credentials" && (
        <Card>
          <CardContent className="p-6">
            <CredentialsManager />
          </CardContent>
        </Card>
      )}

      {activeView === "settings" && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold">GitHub Settings</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure how repositories are fetched from GitHub.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Repository Type</Label>
                <Select value={repositoryType} onValueChange={(v: any) => setRepositoryType(v)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="perPage">Per Page</Label>
                <Input
                  id="perPage"
                  type="number"
                  min="1"
                  max="100"
                  value={perPage}
                  onChange={(e) => setPerPage(parseInt(e.target.value) || 10)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort">Sort By</Label>
                <Select value={sort} onValueChange={(v: any) => setSort(v)}>
                  <SelectTrigger id="sort">
                    <SelectValue placeholder="Select sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="updated">Updated</SelectItem>
                    <SelectItem value="pushed">Pushed</SelectItem>
                    <SelectItem value="full_name">Full Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direction">Direction</Label>
                <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
                  <SelectTrigger id="direction">
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </SectionLayout>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
