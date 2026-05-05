import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GitBranch } from "lucide-react";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold mb-2">Report Settings</h1>
            <p className="text-muted-foreground text-sm">Loading repository information...</p>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-muted rounded-full">
                  <GitBranch className="h-5 w-5 text-muted-foreground animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-32 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-48 animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded w-32 animate-pulse"></div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="h-4 bg-muted rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-10 bg-muted rounded animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 bg-muted rounded w-20 mb-2 animate-pulse"></div>
                <div className="h-10 bg-muted rounded animate-pulse"></div>
              </div>
            </div>
            
            <div>
              <div className="h-4 bg-muted rounded w-32 mb-4 animate-pulse"></div>
              <div className="h-10 bg-muted rounded animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
