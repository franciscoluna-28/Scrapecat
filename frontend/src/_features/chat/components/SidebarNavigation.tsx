"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/src/components/ui/sidebar";
import { Key, Settings } from "lucide-react";
import { IS_DEMO } from "@/src/shared/constants";

const NAV_ITEMS = [
  { id: "credentials", label: "API Keys", icon: Key, route: "/app/api-keys" },
  { id: "settings", label: "Settings", icon: Settings, route: "/app/settings" },
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
        {!IS_DEMO &&
          NAV_ITEMS.map((item) => (
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
          ))}
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
