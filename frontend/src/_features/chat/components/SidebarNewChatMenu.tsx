"use client";

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
import { FolderOpen, Globe, Plus } from "lucide-react";
import type { SidebarProjectEntry } from "@/src/_features/chat/hooks/useSidebarProjects";

type Props = {
  projectEntries: SidebarProjectEntry[];
  onConnectRepository: () => void;
  onSelectProject: (projectId: string) => void;
};

export function SidebarNewChatMenu({
  projectEntries,
  onConnectRepository,
  onSelectProject,
}: Props) {
  const projects = projectEntries.filter(
    (entry): entry is SidebarProjectEntry & { projectId: string } =>
      entry.projectId !== null,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="size-3" />
          New chat
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={onConnectRepository}>
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
              projects.map((entry) => (
                <DropdownMenuItem
                  key={entry.key}
                  onSelect={() => onSelectProject(entry.projectId)}
                >
                  {entry.label}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
