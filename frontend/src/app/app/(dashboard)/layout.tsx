"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/src/components/ui/sidebar";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import { FileText, Settings, Key, MessageSquareText } from "lucide-react";

const NAV_ITEMS = [
  { id: "chat", label: "Chat", icon: MessageSquareText, route: "/app" },
  { id: "reports", label: "Reports", icon: FileText, route: "/app/reports" },
  { id: "credentials", label: "API Keys", icon: Key, route: "/app/api-keys" },
  { id: "settings", label: "Settings", icon: Settings, route: "/app/settings" },
] as const;

function isActive(id: string, pathname: string) {
  switch (id) {
    case "chat":
      return pathname === "/app";
    case "reports":
      return pathname.startsWith("/app/reports");
    case "credentials":
      return pathname.startsWith("/app/api-keys");
    case "settings":
      return pathname.startsWith("/app/settings");
    default:
      return false;
  }
}

function SidebarLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeView = NAV_ITEMS.find((i) => isActive(i.id, pathname))?.id ?? "chat";

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <a href="/app">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                      <Image src={LogoImage} alt="Scrapecat Logo" width={28} height={28} className="size-7" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Scrapecat</span>
                      <span className="truncate text-xs text-muted-foreground">Intelligence</span>
                    </div>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem className="py-1" key={item.id}>
                      <SidebarMenuButton
                        isActive={activeView === item.id}
                        onClick={() => router.push(item.route)}
                        tooltip={item.label}
                      >
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="flex h-12 items-center gap-2 border-b px-4 bg-background/50">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-sm hidden">
              {NAV_ITEMS.find((i) => i.id === activeView)?.label || "Scrapecat"}
            </h1>
          </header>
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SidebarLayoutInner>{children}</SidebarLayoutInner>
    </Suspense>
  );
}
