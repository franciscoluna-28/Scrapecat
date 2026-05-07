"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { GitBranch, Settings } from "lucide-react";
import { RepositoryCard } from "@/src/features/reports/components/RepositoryCard";
import { PageTitle } from "@/src/components/global/PageTitle";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { Button } from "@/src/components/ui/button";
import { useGitHubSettingsStore } from "@/src/store/github-settings";
import { GitHubSettingsModal } from "@/src/components/GitHubSettingsModal";

export default function Page() {
  const { repositoryType, perPage, sort, direction } = useGitHubSettingsStore();
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // TODO: Use SWR instead of doing this by hand
  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "/api/repositories?" +
          new URLSearchParams({
            type: repositoryType,
            sort,
            direction,
            per_page: perPage.toString(),
          }).toString(),
      );

      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }

      const repos = await response.json();
      setRepositories(repos);
    } catch (error) {
      console.error("Error fetching repositories:", error);
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
  }, [repositoryType, perPage, sort, direction]);

  return (
    <>
      <ApplicationLayout>
        <PageTitle title="Select Repository">
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <Settings className="mr-2" /> GitHub Settings
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
                {loading ? (
                  <div className="text-center py-12">
                    <GitBranch className="h-12 w-12 text-foreground mx-auto mb-4 animate-pulse" />
                    <h3 className="text-lg font-medium mb-2">
                      Loading repositories...
                    </h3>
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
                  repositories.map((repo: any) => (
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
