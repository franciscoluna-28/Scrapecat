"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import LogoImage from "@/public/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/src/components/ui/sidebar";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import { SidebarChatSection } from "@/src/_features/chat/components/SidebarChatSection";
import { SidebarNavigation } from "@/src/_features/chat/components/SidebarNavigation";
import { isChatRoute } from "@/src/_features/chat/hooks/chat-url";
import { ScrollContainerProvider } from "@/src/components/global/ScrollContainer";
import { BRAND } from "@/src/shared/constants";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatRoute = isChatRoute(pathname);

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
                      <Image src={LogoImage} alt={BRAND.logoAlt} width={28} height={28} />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{BRAND.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{BRAND.tagline}</span>
                    </div>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            {chatRoute && <SidebarChatSection />}
            <div className={chatRoute ? "mt-auto" : undefined}>
              <SidebarNavigation />
            </div>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col h-svh overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 bg-background/50">
            <SidebarTrigger className="-ml-1" />
          </header>
          <ScrollContainerProvider>{children}</ScrollContainerProvider>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
