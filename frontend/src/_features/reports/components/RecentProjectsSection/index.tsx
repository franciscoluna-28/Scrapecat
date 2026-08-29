"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { GitHubIcon } from "@/src/components/icons/GitHubIcon";
import { Card, CardContent } from "@/src/components/ui/card";

const LIMIT = 5;

export function RecentProjectsSection() {
  const { projects, isLoading } = useProjects();

  if (isLoading || projects.length === 0) return null;

  const recent = [...projects]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, LIMIT);

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Recently used
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {recent.map((project) => (
          <Link
            key={project.id}
            href={`/app/repos/${project.providerProjectId}`}
            className="block"
          >
            <Card className="hover:bg-muted/80 bg-muted/40 transition-colors cursor-pointer ring-0">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                    <GitHubIcon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate text-sm">
                      {project.providerOwner}/{project.repositoryName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Generated {formatDistanceToNow(new Date(project.updatedAt))} ago
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
