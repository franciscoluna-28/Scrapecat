import { Suspense } from "react";
import { DashboardShell } from "@/src/components/global/DashboardShell";
import { Skeleton } from "@/src/components/ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="flex h-svh w-full bg-background" aria-hidden="true">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-3 md:block">
        <Skeleton className="h-10 w-full" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center border-b px-4">
          <Skeleton className="h-6 w-6" />
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    </div>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
