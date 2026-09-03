"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/src/components/ui/combobox";
import { useProjects } from "@/src/_features/reports/services/projects-api";
import { useBranches } from "@/src/_features/reports/services/api";
import {
  useChatSessions,
  useDeleteChatSession,
  prepareProjectBranch,
} from "@/src/_features/chat/services/chat-api";
import { AddRepositoryDialog } from "@/src/_features/chat/components/AddRepositoryDialog";
import { GenerateReportDialog } from "@/src/_features/chat/components/GenerateReportDialog";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/shared/services/keys";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  MessageSquareText,
  GitBranch,
  Link2,
  FileText,
} from "lucide-react";

export function ChatSidebarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { projects, isLoading: projectsLoading } = useProjects();

  const projectId = searchParams.get("project");
  const sessionId = searchParams.get("session");
  const activeProjectData = projects.find((p) => p.id === projectId);

  const { branches, isLoading: branchesLoading } = useBranches(
    activeProjectData?.providerOwner ?? "",
    activeProjectData?.repositoryName ?? "",
  );

  const { sessions, isLoading: sessionsLoading } = useChatSessions(projectId ?? undefined);
  const deleteSession = useDeleteChatSession();

  const projectNames = useMemo(() => projects.map((p) => p.repositoryName), [projects]);
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.repositoryName])),
    [projects],
  );
  const branchList = branches;
  const effectiveBranch = searchParams.get("branch") ?? (branchList[0] ?? null);

  const navigate = (params: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v);
    }
    const url = p.toString() ? `/app?${p.toString()}` : "/app";
    router.push(url);
  };

  const handleProjectChange = (id: string) => {
    navigate({ project: id, session: null, branch: null });
  };

  const handleBranchChange = async (branchName: string) => {
    if (!projectId) return;
    await prepareProjectBranch(projectId, branchName);
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    toast.success(`Ready to chat on ${branchName}`);
    navigate({ project: projectId, session: sessionId, branch: branchName });
  };

  const handleSessionClick = (sid: string) => {
    navigate({ project: projectId, session: sid, branch: null });
  };

  const handleDeleteSession = async (sid: string) => {
    await deleteSession.mutateAsync(sid);
  };

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {projectsLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground text-center">
            No projects synced yet
          </p>
          <AddRepositoryDialog onProjectSelected={(id) => navigate({ project: id })}>
            <Button size="sm" className="w-full gap-2">
              <Link2 className="size-4" />
              Connect repository
            </Button>
          </AddRepositoryDialog>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-muted-foreground">Project</p>
          <Combobox
            items={projectNames}
            value={projectId ? projectMap[projectId] ?? "" : ""}
            onValueChange={(name) => {
              if (!name) return;
              const p = projects.find((pr) => pr.repositoryName === name);
              if (p) handleProjectChange(p.id);
            }}
          >
            <ComboboxInput placeholder="Search projects..." showClear={false} className="h-8 text-xs" />
            <ComboboxContent>
              <ComboboxEmpty>No projects found.</ComboboxEmpty>
              <ComboboxList>
                {(name) => (
                  <ComboboxItem key={name} value={name}>
                    {name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {branchList.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">Branch</p>
              <Combobox
                items={branchList}
                value={searchParams.get("branch") ?? branchList[0] ?? ""}
                onValueChange={(v) => {
                  if (!v) return;
                  handleBranchChange(v);
                }}
                disabled={branchesLoading}
              >
                <ComboboxInput placeholder="Filter branch..." showClear={false} className="h-8 text-xs" />
                <ComboboxContent>
                  <ComboboxEmpty>No branches found.</ComboboxEmpty>
                  <ComboboxList>
                    {(value) => (
                      <ComboboxItem key={value} value={value}>
                        {value}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </>
          )}
          <div className="flex gap-1 mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs justify-start"
              onClick={() => navigate({ project: projectId, session: null, branch: null })}
            >
              <Plus className="size-3" />
              New chat
            </Button>
            <AddRepositoryDialog onProjectSelected={(id) => navigate({ project: id })}>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                <Link2 className="size-3" />
                Connect
              </Button>
            </AddRepositoryDialog>
            {projectId && activeProjectData && (
              <GenerateReportDialog
                projectId={projectId}
                repositoryName={activeProjectData.repositoryName}
                providerOwner={activeProjectData.providerOwner}
                providerProjectId={activeProjectData.providerProjectId}
                branch={effectiveBranch}
                sessionId={sessionId ?? undefined}
              >
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                  <FileText className="size-3" />
                  Report
                </Button>
              </GenerateReportDialog>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-2">History</p>
          {sessionsLoading ? (
            <div className="space-y-1">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No chats yet</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1 rounded px-2 py-1 text-xs cursor-pointer hover:bg-accent ${
                    s.id === sessionId ? "bg-accent" : ""
                  }`}
                  onClick={() => handleSessionClick(s.id)}
                >
                  <MessageSquareText className="size-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {s.title === "New chat"
                      ? new Date(s.updatedAt).toLocaleDateString("en-US")
                      : s.title}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}