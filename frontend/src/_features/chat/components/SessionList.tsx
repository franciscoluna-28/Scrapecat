import {
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/src/components/ui/sidebar";
import { ChatSession } from "@/src/shared/types";
import { Trash2 } from "lucide-react";

type SessionListProps = {
  sessions: ChatSession[];
  isLoading: boolean;
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

export function SessionList({
  sessions,
  isLoading,
  activeSessionId,
  onSelect,
  onDelete,
}: SessionListProps) {
  if (isLoading) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <span className="text-xs text-muted-foreground px-2">Loading...</span>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    );
  }

  if (sessions.length === 0) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <span className="text-xs text-muted-foreground px-2">
            No chats yet
          </span>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    );
  }

  return (
    <SidebarMenuSub>
      {sessions.map((session) => (
        <SidebarMenuSubItem key={session.id}>
          <SidebarMenuSubButton
            isActive={session.id === activeSessionId}
            onClick={() => onSelect(session.id)}
            className="group"
          >
            <span className="flex-1 truncate text-xs">
              {session.title === "New chat"
                ? new Date(session.updatedAt).toLocaleDateString("en-US")
                : session.title}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 ml-auto"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(session.id);
              }}
              aria-label="Delete chat"
            >
              <Trash2 className="size-3" />
            </button>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}
