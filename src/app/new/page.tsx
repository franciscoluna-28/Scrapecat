import { getAllRepositories } from "../../shared/services/github";
import { Card, CardContent } from "@/src/components/ui/card";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { GitBranch } from "lucide-react";
import { RepositoryCard } from "@/src/features/reports/components/RepositoryCard";
import { PageTitle } from "@/src/components/global/PageTitle";
import { SectionLayout } from "@/src/components/global/SectionLayout";

export default async function Page() {
  const repositories = await getAllRepositories();

  return (
    <ApplicationLayout>
      <PageTitle title="Select Repository" />
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
                repositories.map((repo) => (
                  <RepositoryCard key={repo.id} repository={repo} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </SectionLayout>
    </ApplicationLayout>
  );
}
