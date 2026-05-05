import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllRepositories } from "../actions/github";
import { GitHubRepository } from "../actions/github";
import { GitBranch, Star, Clock, ChevronRight } from "lucide-react";

export default async function CreateReportPage() {
  const repositories = await getAllRepositories();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center mb-8">
   
          
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2">Create Report</h1>
          <p className="text-muted-foreground text-sm">Choose a repository to generate a commit report</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Select Repository
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {repositories.length === 0 ? (
              <div className="text-center py-12">
                <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No repositories found</h3>
                <p className="text-muted-foreground">
                  Ensure your GITHUB_TOKEN has access to your repositories and is properly configured.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {repositories.map((repo) => (
                  <RepositoryCard key={repo.id} repository={repo} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RepositoryCard({ repository }: { repository: GitHubRepository }) {
  return (
    <Card className="hover:bg-accent/50 transition-colors cursor-pointer hover:border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">
                {repository.name}
              </h3>
              {repository.private && (
                <Badge variant="secondary" className="text-xs">{repository.private ? "Private" : "Public"}</Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-2 truncate">
              {repository.description || "No description available"}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                <span>{repository.stargazers_count}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Updated {repository.updated_at ? new Date(repository.updated_at).toLocaleDateString() : "Unknown"}</span>
              </div>
            </div>
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
