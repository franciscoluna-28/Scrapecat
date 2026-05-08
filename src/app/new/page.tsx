"use client";

import { useState } from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { GitBranch, Settings } from "lucide-react";
import { RepositoryCard } from "@/src/features/reports/components/RepositoryCard";
import { PageTitle } from "@/src/components/global/PageTitle";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { Button } from "@/src/components/ui/button";
import { useGitHubSettingsStore } from "@/src/store/github-settings";
import { GitHubSettingsModal } from "@/src/components/GitHubSettingsModal";
import { useRepositories } from "@/src/features/reports/services/api";
import { GitHubRepository } from "@/src/shared/types";

export default function Page() {
  const { repositoryType, perPage, sort, direction } = useGitHubSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);

  const { repositories, isFetching, hasError } = useRepositories({
    type: repositoryType,
    sort,
    direction,
    per_page: perPage,
  });

  return (
    <>
      <ApplicationLayout>
        <PageTitle title="Select Repository">
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <Settings className="mr-2" /> Settings
          </Button>
        </PageTitle>
        <SectionLayout>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div
                className="h-[70vh] overflow-y-auto p-6 space-y-2 scrollbar-stable"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "hsl(var(--foreground) / 0.2) transparent",
                }}
              >
                {isFetching ? (
                  <div className="text-center py-12">
                    <GitBranch className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                    <h3 className="text-lg font-medium mb-2">
                      Loading repositories...
                    </h3>
                  </div>
                ) : hasError ? (
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
            </CardContent>
          </Card>
        </SectionLayout>
      </ApplicationLayout>

      <GitHubSettingsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
