"use client";

import { useState } from "react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/src/components/ui/sidebar";
import { ChevronRight } from "lucide-react";
import { cn } from "@/src/shared/lib/utils";
import type { DemoProjectEntry } from "@/src/_features/demo/hooks/useDemoProjects";
import type { SidebarProjectEntry } from "@/src/_features/chat/hooks/useSidebarProjects";
import type { ChatSession } from "@/src/shared/types";
import { SessionList } from "./SessionList";

type Props = {
  entries: SidebarProjectEntry[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  sessions: ChatSession[];
  sessionsLoading: boolean;
  openingDemoRepo: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectDemo: (demo: DemoProjectEntry) => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export function SidebarProjectList({
  entries,
  activeProjectId,
  activeSessionId,
  sessions,
  sessionsLoading,
  openingDemoRepo,
  onSelectProject,
  onSelectDemo,
  onSelectSession,
  onDeleteSession,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <SidebarMenu className="gap-0">
      {entries.map((entry) => {
        const isActive =
          entry.projectId !== null && entry.projectId === activeProjectId;

        const handleClick = () => {
          if (entry.demo) {
            onSelectDemo(entry.demo);
            return;
          }
          if (isActive) {
            setExpanded((value) => !value);
            return;
          }
          if (entry.projectId) {
            onSelectProject(entry.projectId);
            setExpanded(true);
          }
        };

        return (
          <SidebarMenuItem key={entry.key}>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={entry.label}
              onClick={handleClick}
            >
              <ChevronRight
                className={cn(
                  "size-3 shrink-0 transition-transform",
                  isActive && expanded && "rotate-90",
                )}
              />
              <span className="truncate">{entry.label}</span>
              {entry.demo &&
                !entry.projectId &&
                openingDemoRepo === entry.demo.repo && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Loading...
                  </span>
                )}
            </SidebarMenuButton>
            {isActive && expanded && (
              <SessionList
                sessions={sessions}
                isLoading={sessionsLoading}
                activeSessionId={activeSessionId}
                onSelect={onSelectSession}
                onDelete={onDeleteSession}
              />
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

