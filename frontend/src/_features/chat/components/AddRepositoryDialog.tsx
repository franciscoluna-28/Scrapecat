"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Plus } from "lucide-react";
import { useAddRepository } from "@/src/_features/chat/hooks/useAddRepository";
import { RepositoryUrlInput } from "@/src/_features/chat/components/RepositoryUrlInput";
import { RepositoryList } from "@/src/_features/chat/components/RepositoryList";
import type { GitHubRepository } from "@/src/shared/types";

type Props = {
  onProjectSelected: (projectId: string) => void;
  children?: React.ReactNode;
};

export function AddRepositoryDialog({ onProjectSelected, children }: Props) {
  const {
    open,
    setOpen,
    value,
    onValueChange,
    error,
    connecting,
    repositories,
    isFetching,
    existingProjectIds,
    connectByRepo,
    connectByUrl,
  } = useAddRepository(onProjectSelected);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="w-full justify-start">
            <Plus className="size-4" />
            Connect repository
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a repository</DialogTitle>
          <DialogDescription>
            Pick from your GitHub repos or paste a URL.
          </DialogDescription>
        </DialogHeader>

        <RepositoryUrlInput
          value={value}
          onValueChange={onValueChange}
          onConnect={connectByUrl}
          connecting={connecting}
          error={error}
        />

        <div className="text-xs text-muted-foreground">
          Or select from your repositories:
        </div>

        <RepositoryList
          repositories={repositories as GitHubRepository[]}
          isLoading={isFetching}
          existingProjectIds={existingProjectIds}
          connecting={connecting}
          onSelect={connectByRepo}
        />
      </DialogContent>
    </Dialog>
  );
}
