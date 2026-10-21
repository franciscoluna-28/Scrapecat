"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { useAddRepository } from "@/src/_features/git-providers/hooks/useAddRepository";
import { RepositoryUrlInput } from "@/src/_features/chat/components/RepositoryUrlInput";
import { RepositoryList } from "@/src/_features/chat/components/RepositoryList";
import { GitProviderConnectForm } from "@/src/_features/git-providers/components/GitProviderConnectForm";
import {
  GIT_PROVIDER_META,
  IS_DEMO,
  type GitProviderId,
} from "@/src/shared/constants";

type Props = {
  onProjectSelected: (projectId: string) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AddRepositoryDialog({ onProjectSelected, children, open: controlledOpen, onOpenChange }: Props) {
  const [provider, setProvider] = useState<GitProviderId>("github");

  const {
    open: internalOpen,
    setOpen: internalSetOpen,
    value,
    onValueChange,
    error,
    connecting,
    repositories,
    isFetching,
    connectedProviders,
    existingProjectIds,
    connectByRepo,
    connectByUrl,
  } = useAddRepository(onProjectSelected, provider);

  // Demo serves public GitHub search without a token, so the list is usable
  // even though no provider is "connected".
  const hasRepositories = IS_DEMO || connectedProviders.length > 0;
  const meta = GIT_PROVIDER_META[provider];

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
            {IS_DEMO
              ? "Add a public GitHub repository by URL, or pick from popular public repos."
              : "Pick from your GitHub or GitLab repos or paste a URL."}
          </DialogDescription>
        </DialogHeader>

        {!hasRepositories ? (
          <div className="space-y-3">
            <GitProviderConnectForm
              provider={provider}
              onProviderChange={setProvider}
              compact
            />
            <p className="text-xs text-muted-foreground">
              Connect one provider to browse repositories.
            </p>
          </div>
        ) : (
          <>
            {/* Demo mode uses the deployer's server-side token (public repos
                only) — never ask visitors for their own GitHub token. */}
            {!IS_DEMO && (
              <div className="rounded-md border p-2">
                <GitProviderConnectForm
                  provider={provider}
                  onProviderChange={setProvider}
                  compact
                />
              </div>
            )}

            {IS_DEMO && (
              <p className="text-xs text-muted-foreground">
                Public repositories only. Paste any public GitHub repo URL or
                owner/repo below.
              </p>
            )}

            <RepositoryUrlInput
              value={value}
              onValueChange={onValueChange}
              onConnect={connectByUrl}
              connecting={connecting}
              error={error}
              placeholder={`Paste a ${meta.label} URL or owner/repo`}
            />

            <div className="text-xs text-muted-foreground">
              {IS_DEMO ? "Or pick a popular public repo:" : "Or select from your repositories:"}
            </div>

            <RepositoryList
              repositories={repositories}
              isLoading={isFetching}
              existingProjectIds={existingProjectIds}
              connecting={connecting}
              onSelect={connectByRepo}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
