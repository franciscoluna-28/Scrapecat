"use client";

import Link from "next/link";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import { GitHubRepository } from "@/src/shared/types";
import { Clock, GitBranch, ChevronRight } from "lucide-react";

type Props = {
  repository: GitHubRepository;
  onSelect?: () => void;
};

export function RepositoryCard({ repository, onSelect }: Props) {
  const card = (
    <Card
      className="hover:bg-muted/80 bg-muted/40 transition-colors cursor-pointer ring-0"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold truncate">{repository.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {repository.private ? "Private" : "Public"}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Updated:{" "}
                  {repository.updated_at
                    ? new Date(repository.updated_at).toLocaleDateString(
                        "en-US",
                      )
                    : "Unknown"}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Repository ID: {repository.id}
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground ml-4 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );

  if (onSelect) {
    return card;
  }

  return (
    <Link href={`/new/settings?githubId=${repository.id}`} className="block">
      {card}
    </Link>
  );
}
