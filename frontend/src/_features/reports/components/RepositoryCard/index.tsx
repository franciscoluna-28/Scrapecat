"use client";

import Link from "next/link";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import { GitHubRepository } from "@/src/shared/types";
import { ChevronRight } from "lucide-react";

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
              <h3 className="font-semibold truncate">{repository.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {repository.private ? "Private" : "Public"}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Updated:{" "}
                {repository.updated_at
                  ? new Date(repository.updated_at).toLocaleDateString(
                      "en-US",
                    )
                  : "Unknown"}
              </span>
              <span>ID: {repository.id}</span>
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
    <Link href={`/app/repos/${repository.id}`} className="block">
      {card}
    </Link>
  );
}
