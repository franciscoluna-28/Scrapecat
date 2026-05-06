import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import { GitHubRepository } from "@/src/shared/types";
import { Clock, ChevronRight } from "lucide-react";

type Props = {
  repository: GitHubRepository;
  onSelect: () => void;
};

export function RepositoryCard({ repository, onSelect }: Props) {
  return (
    <Card
      className="hover:bg-muted/80 bg-muted/40 transition-colors cursor-pointer ring-0! "
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{repository.name}</h3>
            </div>

            <p className="text-sm text-muted-foreground mb-2 truncate">
              {repository.description || "No description available"}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Updated at:{" "}
                  {repository.updated_at
                    ? new Date(repository.updated_at).toLocaleDateString(
                        "en-US",
                      )
                    : "Unknown"}
                </span>
                <Badge variant="outline" className="text-xs border-none">
                  {repository.private ? "Private" : "Public"}
                </Badge>
              </div>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
