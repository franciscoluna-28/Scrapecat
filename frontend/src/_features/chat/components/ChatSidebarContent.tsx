"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/src/components/ui/sidebar";
import {
  useChatSessions,
  useDeleteChatSession,
} from "@/src/_features/chat/services/chat-api";
import { AddRepositoryDialog } from "@/src/_features/chat/components/AddRepositoryDialog";
import { useProjects } from "@/src/_features/chat/services/projects-api";
import { cn } from "@/src/shared/lib/utils";
import {
  ChevronRight,
  Key,
  Settings,
  Trash2,
  Plus,
  Globe,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/src/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { id: "credentials", label: "API Keys", icon: Key, route: "/app/api-keys" },
  { id: "settings", label: "Settings", icon: Settings, route: "/app/settings" },
] as const;

export function ChatSidebarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { projects, isLoading: projectsLoading } = useProjects();

  const projectId = searchParams.get("project");
  const sessionId = searchParams.get("session");

  const { sessions, isLoading: sessionsLoading } = useChatSessions(projectId ?? undefined);
  const deleteSession = useDeleteChatSession();

  const [expanded, setExpanded] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);

  const navigate = (params: Record<string, string | null>) => {
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

  const isActive = (route: string) => pathname.startsWith(route);

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {projectsLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <div className="space-y-3 py-4">
          <p className="text-xs text-muted-foreground text-center">
            No projects synced yet...
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="size-3" />
                New chat
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => setConnectOpen(true)}>
                <Globe className="size-4" />
                Connect repository...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderOpen className="size-4" />
                  Select existing project
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <>
          <div className="flex py-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="size-3" />
                  New chat
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onSelect={() => setConnectOpen(true)}>
                  <Globe className="size-4" />
                  Connect repository...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderOpen className="size-4" />
                    Select existing project
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {projects.length === 0 ? (
                      <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
                    ) : (
                      projects.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={() => navigate({ project: p.id, session: null, branch: null })}
                        >
                          {p.repositoryName}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Projects</p>
          <SidebarMenu className="gap-0">
            {projects.map((p) => {
              const isActiveProject = p.id === projectId;
              const projectSessions = isActiveProject ? sessions : [];

              return (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={isActiveProject}
                    tooltip={p.repositoryName}
                    onClick={() => {
                      if (isActiveProject) {
                        setExpanded(!expanded);
                      } else {
                        navigate({ project: p.id, session: null, branch: null });
                        setExpanded(true);
                      }
                    }}
                  >
                    <ChevronRight
                      className={cn(
                        "size-3 shrink-0 transition-transform",
                        isActiveProject && expanded && "rotate-90",
                      )}
                    />
                    <span className="truncate">{p.repositoryName}</span>
                  </SidebarMenuButton>
                  {isActiveProject && expanded && (
                    <SidebarMenuSub>
                      {sessionsLoading ? (
                        <SidebarMenuSubItem>
                          <span className="text-xs text-muted-foreground px-2">Loading...</span>
                        </SidebarMenuSubItem>
                      ) : projectSessions.length === 0 ? (
                        <SidebarMenuSubItem>
                          <span className="text-xs text-muted-foreground px-2">No chats yet</span>
                        </SidebarMenuSubItem>
                      ) : (
                        projectSessions.map((s) => (
                          <SidebarMenuSubItem key={s.id}>
                            <SidebarMenuSubButton
                              isActive={s.id === sessionId}
                              onClick={() => handleSessionClick(s.id)}
                              className="group"
                            >
                              <span className="flex-1 truncate text-xs">
                                {s.title === "New chat"
                                  ? new Date(s.updatedAt).toLocaleDateString("en-US")
                                  : s.title}
                              </span>
                              <button
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 ml-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSession(s.id);
                                }}
                                aria-label="Delete chat"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      )}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </>
      )}

      <AddRepositoryDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onProjectSelected={(id) => { setConnectOpen(false); navigate({ project: id }); }}
      />

      <p className="text-xs font-medium text-muted-foreground mt-2">Navigation</p>
      <SidebarMenu className="gap-0">
        {NAV_ITEMS.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={isActive(item.route)}
              onClick={() => router.push(item.route)}
              tooltip={item.label}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </div>
  );
}