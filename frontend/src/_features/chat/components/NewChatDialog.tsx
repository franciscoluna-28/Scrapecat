"use client";

import { useMemo, useState } from "react";
import { Globe, Loader2, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { GitProviderIcon } from "@/src/_features/git-providers/components/GitProviderIcon";
import {
  useSidebarProjects,
  type SidebarProjectEntry,
} from "@/src/_features/chat/hooks/useSidebarProjects";
import { ALLOW_ADD_REPOS } from "@/src/shared/constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProject: (projectId: string) => void;
  onConnectRepository: () => void;
};

/**
 * Gemini-style entry point for a new chat: pick an already-connected project
 * or jump into the connect-repository flow.
 */
export function NewChatDialog({
  open,
  onOpenChange,
  onSelectProject,
  onConnectRepository,
}: Props) {
  const { projectEntries, ensureProject } = useSidebarProjects();
  const [query, setQuery] = useState("");
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projectEntries;
    return projectEntries.filter((entry) =>
      `${entry.owner}/${entry.repositoryName} ${entry.label}`
        .toLowerCase()
        .includes(needle),
    );
  }, [projectEntries, query]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setOpeningKey(null);
    }
    onOpenChange(nextOpen);
  };

  const choose = async (entry: SidebarProjectEntry) => {
    if (openingKey) return;
    if (entry.projectId) {
      onSelectProject(entry.projectId);
      handleOpenChange(false);
      return;
    }
    if (!entry.demo) return;

    setOpeningKey(entry.key);
    const id = await ensureProject(entry.demo);
    setOpeningKey(null);
    if (id) {
      onSelectProject(id);
      handleOpenChange(false);
    }
  };

  const connect = () => {
    handleOpenChange(false);
    onConnectRepository();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>
            Pick a connected project, or connect a repository to start a chat.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="pl-8"
            aria-label="Search projects"
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {projectEntries.length === 0
                ? "No projects connected yet."
                : "No matching projects."}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => void choose(entry)}
                  disabled={!!openingKey}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <GitProviderIcon
                    provider={entry.gitProvider}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.owner}/{entry.repositoryName}
                  </span>
                  {openingKey === entry.key && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {ALLOW_ADD_REPOS && (
          <>
            <div className="h-px bg-border" />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={connect}
            >
              <Globe className="size-4" />
              Connect repository...
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
