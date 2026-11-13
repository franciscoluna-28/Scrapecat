"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import {
  useDeleteChatSession,
  useRecentChatSessions,
} from "@/src/_features/chat/services/chat-api";
import { AddRepositoryDialog } from "@/src/_features/chat/components/AddRepositoryDialog";
import { NewChatDialog } from "@/src/_features/chat/components/NewChatDialog";
import { useActiveProjectStore } from "@/src/store/active-project";
import { errorMessage } from "@/src/shared/api/client";

/**
 * Chat-specific sidebar: the New chat entry point plus a flat list of recent
 * conversations across every project. Only rendered on `/app/chat`.
 */
export function SidebarChatSection() {
  const router = useRouter();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { sessions, isLoading: sessionsLoading } = useRecentChatSessions();
  const deleteSession = useDeleteChatSession();
  const setLastProjectId = useActiveProjectStore((s) => s.setLastProjectId);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const openChat = (projectId: string, sessionId?: string) => {
    setLastProjectId(projectId);
    const params = new URLSearchParams({ project: projectId });
    if (sessionId) params.set("session", sessionId);
    router.push(`/app/chat?${params.toString()}`);
  };

  const handleDelete = async (sessionId: string) => {
    try {
      await deleteSession.mutateAsync(sessionId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete chat"));
    }
  };

  const isLoading = projectsLoading || sessionsLoading;

  return (
    <div className="flex flex-col gap-2 px-3 py-2 group-data-[collapsible=icon]:hidden">
      <Button
        className="w-full justify-start"
        onClick={() => setNewChatOpen(true)}
      >
        <MessageSquarePlus className="size-4" />
        New chat
      </Button>

      <p className="mt-1 text-xs font-medium text-muted-foreground">
        Recent chats
      </p>

      {isLoading ? (
        <div className="space-y-1">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          {projects.length === 0
            ? "Connect a repository to get started."
            : "No chats yet."}
        </p>
      ) : (
        <div className="space-y-0.5">
          {sessions.map((session) => {
            const project = projectsById.get(session.projectId);
            const repository = project
              ? `${project.providerOwner}/${project.repositoryName}`
              : "Unknown project";
            const title =
              session.title === "New chat"
                ? new Date(session.updatedAt).toLocaleDateString("en-US")
                : session.title;

            return (
              <div
                key={session.id}
                className="group/item flex items-center gap-1 rounded-md hover:bg-accent"
              >
                <button
                  type="button"
                  onClick={() => openChat(session.projectId, session.id)}
                  className="min-w-0 flex-1 px-2 py-1.5 text-left"
                >
                  <span className="block truncate text-xs">{title}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {repository}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(session.id)}
                  aria-label="Delete chat"
                  className="mr-1 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onSelectProject={(projectId) => openChat(projectId)}
        onConnectRepository={() => setConnectOpen(true)}
      />

      <AddRepositoryDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onProjectSelected={(projectId) => {
          setConnectOpen(false);
          openChat(projectId);
        }}
      />
    </div>
  );
}
