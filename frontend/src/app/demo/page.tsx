"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Book, ExternalLink, GitBranch, FileText, Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent } from "@/src/components/ui/card";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { ApplicationLayout } from "@/src/components/global/ApplicationLayout";
import { PageTitle } from "@/src/components/global/PageTitle";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { useDemoClientReportsStore } from "@/src/store/demo-client-reports";
import { Badge } from "@/src/components/ui/badge";

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s?#]+)/,
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export default function DemoPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);

  useEffect(() => {
    fetch("/api/demo/reports?limit=1")
      .then(() => setHasToken(true))
      .catch(() => setHasToken(false))
      .finally(() => setTokenLoading(false));
  }, []);

  const { reports } = useDemoClientReportsStore();

  const handleAnalyze = () => {
    setError(null);
    const parsed = parseGithubUrl(url);
    if (!parsed) {
      setError(
        "Invalid GitHub URL. Use format: https://github.com/owner/repo",
      );
      return;
    }
    router.push(
      `/demo/settings?owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`,
    );
  };

  return (
    <ApplicationLayout>
      <PageTitle title="Fabric Demo" />
      <SectionLayout>
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <Book className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              Generate Reports from GitHub Repositories
            </h2>
            <p className="text-sm text-muted-foreground">
              Paste a public GitHub repository URL to get started
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/vercel/next.js"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAnalyze();
                  }}
                />
                <Button onClick={handleAnalyze}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Analyze
                </Button>
              </div>
              {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
              )}
            </CardContent>
          </Card>

          {reports.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Recent Reports
              </h3>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-64">
                    <div className="p-3 space-y-2">
                      {reports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/80 transition-colors cursor-pointer"
                          onClick={() =>
                            router.push(`/demo/report?reportId=${report.id}`)
                          }
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {report.githubRepositoryName}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {report.branch}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(report.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SectionLayout>
    </ApplicationLayout>
  );
}
