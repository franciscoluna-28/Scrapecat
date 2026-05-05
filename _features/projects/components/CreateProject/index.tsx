"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Folder,
  Lock,
  Calendar,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/app/actions/projects";
import { toast } from "sonner";
import { GitHubRepository } from "@/app/actions/github";
import { RepositoryInput } from "@/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositories: GitHubRepository[];
};

/** Creates a new project based on the available repositories from the GitHub account. */
export function CreateProjectModal({
  open,
  onOpenChange,
  repositories,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingRepoId, setCreatingRepoId] = useState<number | null>(null);
  const router = useRouter();

  const filteredRepositories = useMemo(() => {
    if (!searchQuery.trim()) return repositories;

    const query = searchQuery.toLowerCase();
    return repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.full_name.toLowerCase().includes(query) ||
        (repo.description && repo.description.toLowerCase().includes(query)),
    );
  }, [repositories, searchQuery]);

  const handleCreateProject = async (repository: RepositoryInput) => {
    setCreatingRepoId(repository.id);

    try {
      const result = await createProjectAction(repository);

      if (!result.data?.success || !result.data.project) {
        toast.error(result.data?.error || "Failed to create project");
        return;
      }

      toast.success("Project created successfully!");
      onOpenChange(false);
      router.push(`/projects/${result.data.project.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project",
      );
    } finally {
      setCreatingRepoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl!  max-h-[80vh] bg-background border-border">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-border text-foreground placeholder-muted-foreground"
            />
          </div>

          <ScrollArea className="h-96">
            {filteredRepositories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Folder className="h-12 w-12 text-zinc-600 mb-2" />
                <p className="text-zinc-400">
                  {repositories.length === 0
                    ? "No repositories found"
                    : "No repositories match your search"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRepositories.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-4 bg-background border border-border rounded-lg hover:bg-muted-foreground/10 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                          <h3 className="font-medium text-foreground truncate">
                            {repo.name}
                          </h3>
                          {repo.private && (
                            <Badge variant="secondary" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              Private
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-zinc-400 mb-2 line-clamp-2">
                          {repo.description || "No description available"}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Updated{" "}
                              {repo.updated_at
                                ? new Date(repo.updated_at).toLocaleDateString()
                                : "Unknown"}
                            </span>
                          </div>
                          <span className="font-mono text-zinc-600">
                            {repo.full_name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <a
                          href={`https://github.com/${repo.full_name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <Button
                          size="sm"
                          onClick={() => handleCreateProject({
                            id: repo.id,
                            name: repo.name,
                            full_name: repo.full_name,
                            description: repo.description || "",
                            private: repo.private,
                            updated_at: repo.updated_at || "",
                          })}
                          disabled={creatingRepoId === repo.id}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {creatingRepoId === repo.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create Project"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
