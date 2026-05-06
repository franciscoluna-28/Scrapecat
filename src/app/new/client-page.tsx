"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/src/components/ui/card";
import { useFormStore } from "@/src/shared/lib/formStore";
import { GitBranch } from "lucide-react";
import { GitHubRepository } from "@/src/shared/types";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { RepositoryCard } from "@/src/features/reports/components/RepositoryCard";

interface CreateReportClientPageProps {
  repositories: GitHubRepository[];
}

export default function CreateReportClientPage({
  repositories,
}: CreateReportClientPageProps) {
  const router = useRouter();
  const { setSelectedRepository } = useFormStore();

  const handleRepositorySelect = (repo: GitHubRepository) => {
    setSelectedRepository(repo);
    router.push(`/new/settings?githubId=${repo.id}`);
  };

  return (
    <ApplicationLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2">Select Repository </h1>
          <p className="text-muted-foreground text-sm">
            Choose a repository to generate your report.
          </p>
        </div>

        <Card className="lg:max-h-[80vh]">
          <CardContent>
            {repositories.length === 0 ? (
              <div className="text-center py-12">
                <GitBranch className="h-12 w-12 text-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No repositories found
                </h3>
                <p className="text-muted-foreground">
                  Ensure your GITHUB_TOKEN has access to your repositories and
                  is properly configured.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(80vh-100px)]">
                <div className="space-y-2!">
                  {repositories.map((repo) => (
                    <RepositoryCard
                      key={repo.id}
                      repository={repo}
                      onSelect={() => handleRepositorySelect(repo)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </ApplicationLayout>
  );
}
