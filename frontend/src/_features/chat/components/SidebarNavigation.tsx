"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/src/components/ui/sidebar";
import { Key, LayoutDashboard, MessageSquare, Settings } from "lucide-react";
import { IS_DEMO } from "@/src/shared/constants";

const NAV_ITEMS = [
  {
    id: "reports",
    label: "Reports",
    icon: LayoutDashboard,
    route: "/app/dashboard",
    demoHidden: true,
  },
  {
    id: "chats",
    label: "Chats",
    icon: MessageSquare,
    route: "/app/chat",
    demoHidden: false,
  },
  {
    id: "credentials",
    label: "API Keys",
    icon: Key,
    route: "/app/api-keys",
    demoHidden: true,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    route: "/app/settings",
    demoHidden: false,
  },
] as const;

export function SidebarNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <>
      <p className="text-xs font-medium text-muted-foreground mt-2">
        Navigation
      </p>
      <SidebarMenu className="gap-0">
        {NAV_ITEMS.filter((item) => !(IS_DEMO && item.demoHidden)).map(
          (item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                isActive={pathname.startsWith(item.route)}
                onClick={() => router.push(item.route)}
                tooltip={item.label}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ),
        )}
        {IS_DEMO && (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={false}
              tooltip="API keys are managed by the server"
            >
              <Key className="size-4 opacity-60" />
              <span className="text-muted-foreground">
                Keys managed by server
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </>
  );
}
