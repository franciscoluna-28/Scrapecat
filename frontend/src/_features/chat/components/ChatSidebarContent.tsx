"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  useChatSessions,
  useDeleteChatSession,
} from "@/src/_features/chat/services/chat-api";
import { AddRepositoryDialog } from "@/src/_features/chat/components/AddRepositoryDialog";
import { SidebarNewChatMenu } from "@/src/_features/chat/components/SidebarNewChatMenu";
import { SidebarProjectList } from "@/src/_features/chat/components/SidebarProjectList";
import { SidebarNavigation } from "@/src/_features/chat/components/SidebarNavigation";
import { useSidebarProjects } from "@/src/_features/chat/hooks/useSidebarProjects";
import { resolveActiveProjectId } from "@/src/_features/chat/hooks/useChatProject";
import { useActiveProjectStore } from "@/src/store/active-project";
import { IS_DEMO, ALLOW_ADD_REPOS } from "@/src/shared/constants";
import type { DemoProjectEntry } from "@/src/_features/demo/hooks/useDemoProjects";

export function ChatSidebarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    projectEntries,
    projects,
    isLoading: projectsLoading,
    isDemo,
    ensureProject,
  } = useSidebarProjects();
  const lastProjectId = useActiveProjectStore((s) => s.lastProjectId);
  const setLastProjectId = useActiveProjectStore((s) => s.setLastProjectId);

  const projectId = resolveActiveProjectId({
    projectParam: searchParams.get("project"),
    lastProjectId,
    projects,
    projectsLoading,
    isDemo,
  });
  const sessionId = searchParams.get("session");

  const { sessions, isLoading: sessionsLoading } = useChatSessions(
    projectId ?? undefined,
  );
  const deleteSession = useDeleteChatSession();

  const [connectOpen, setConnectOpen] = useState(false);
  const [openingDemo, setOpeningDemo] = useState<string | null>(null);

  const navigate = (params: Record<string, string | null>) => {
    if (params.project) setLastProjectId(params.project);
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v);
    }
    const url = p.toString() ? `/app?${p.toString()}` : "/app";
    router.push(url);
  };

  const handleSessionClick = (sid: string) => {
    navigate({ project: projectId, session: sid, branch: null });
  };

  const handleDeleteSession = async (sid: string) => {
    await deleteSession.mutateAsync(sid);
  };

  const handleDemoClick = async (demo: DemoProjectEntry) => {
    if (demo.projectId) {
      navigate({ project: demo.projectId, session: null, branch: null });
      return;
    }
    // Wait for the project list so we don't create a duplicate row.
    if (openingDemo || projectsLoading) return;
    setOpeningDemo(demo.repo);
    const id = await ensureProject(demo);
    setOpeningDemo(null);
    if (id) navigate({ project: id, session: null, branch: null });
  };

  const handleSelectProject = (id: string) => {
    navigate({ project: id, session: null, branch: null });
  };

  const openConnectDialog = () => setConnectOpen(true);

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {projectsLoading && projectEntries.length === 0 ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : projectEntries.length === 0 ? (
        <div className="space-y-3 py-4">
          <p className="text-xs text-muted-foreground text-center">
            {IS_DEMO
              ? "Demo mode: pick a public repo to ask about its recent commits."
              : "No projects synced yet..."}
          </p>
          <SidebarNewChatMenu
            projectEntries={projectEntries}
            onConnectRepository={openConnectDialog}
            onSelectProject={handleSelectProject}
          />
        </div>
      ) : (
        <>
          {ALLOW_ADD_REPOS && !isDemo && (
            <div className="flex py-1">
              <SidebarNewChatMenu
                projectEntries={projectEntries}
                onConnectRepository={openConnectDialog}
                onSelectProject={handleSelectProject}
              />
            </div>
          )}
          <p className="text-xs font-medium text-muted-foreground">Projects</p>
          <SidebarProjectList
            entries={projectEntries}
            activeProjectId={projectId}
            activeSessionId={sessionId}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            openingDemoRepo={openingDemo}
            onSelectProject={handleSelectProject}
            onSelectDemo={handleDemoClick}
            onSelectSession={handleSessionClick}
            onDeleteSession={handleDeleteSession}
          />
        </>
      )}

      <AddRepositoryDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onProjectSelected={(id) => {
          setConnectOpen(false);
          navigate({ project: id });
        }}
      />

      <SidebarNavigation />
    </div>
  );
}
