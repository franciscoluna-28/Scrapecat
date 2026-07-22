"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Separator } from "@/src/components/ui/separator";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import { GitBranch, FileText, Settings } from "lucide-react";

const NAV_ITEMS = [
  { id: "repositories", label: "Repositories", icon: GitBranch },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

function SidebarLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") || "repositories";

  return (
    <TooltipProvider delayDuration={0}>
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href="/new">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                    <Image src={LogoImage} alt="Fabric Logo" width={28} height={28} className="size-7" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Fabric</span>
                    <span className="truncate text-xs text-muted-foreground">Reports</span>
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
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeView === item.id}
                      onClick={() => router.push(`/new?view=${item.id}`)}
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
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-mono font-bold tracking-tight uppercase">
            {NAV_ITEMS.find((i) => i.id === activeView)?.label || "Fabric"}
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
