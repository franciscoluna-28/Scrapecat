"use client";

import Link from "next/link";
import { Card, CardContent } from "@/src/components/ui/card";
import { GitHubRepository } from "@/src/shared/types";
import { ChevronRight } from "lucide-react";
import { GitHubIcon } from "@/src/components/icons/GitHubIcon";

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
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/70">
            <GitHubIcon className="h-5 w-5 text-foreground" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{repository.full_name}</h3>
            <div className="text-xs text-muted-foreground">
              {repository.private ? "private" : "public"}
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground ml-2 shrink-0" />
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
