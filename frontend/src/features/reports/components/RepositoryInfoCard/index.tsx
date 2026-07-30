import { Star, GitFork } from "lucide-react";
import { GitHubRepository } from "@/src/shared/types";
import { Card, CardContent } from "@/src/components/ui/card";

interface RepositoryInfoCardProps {
  repository: GitHubRepository;
}

export function RepositoryInfoCard({ repository }: RepositoryInfoCardProps) {
  return (
    <Card size="sm" className="mt-6 inline-flex">
      <CardContent className="flex items-center gap-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{repository.owner.login}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">{repository.name}</span>
        </div>

        {repository.stargazers_count !== undefined && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-4 w-4" />
            <span>{repository.stargazers_count.toLocaleString()}</span>
          </div>
        )}

        {repository.forks_count !== undefined && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <GitFork className="h-4 w-4" />
            <span>{repository.forks_count.toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
