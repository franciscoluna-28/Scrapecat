"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { useAddRepository } from "@/src/_features/chat/hooks/useAddRepository";
import { RepositoryUrlInput } from "@/src/_features/chat/components/RepositoryUrlInput";
import { RepositoryList } from "@/src/_features/chat/components/RepositoryList";
import type { GitHubRepository } from "@/src/shared/types";

type Props = {
  onProjectSelected: (projectId: string) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AddRepositoryDialog({ onProjectSelected, children, open: controlledOpen, onOpenChange }: Props) {
  const {
    open: internalOpen,
    setOpen: internalSetOpen,
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

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? internalSetOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
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
