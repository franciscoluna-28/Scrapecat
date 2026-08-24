"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { SettingsForm } from "@/src/_features/reports/components/SettingsForm";
import { RepositoryInfoCard } from "@/src/_features/reports/components/RepositoryInfoCard";
import { useBranches } from "@/src/_features/reports/services/api";
import { useDemoRepoStore } from "@/src/store/demo-repo";
import { parseRepoUrl } from "@/src/shared/utils/repo-url";
import { GitBranch, Link2 } from "lucide-react";
import type { GitHubRepository } from "@/src/shared/types";

const DEMO_REPO_ID = "demo";

function DemoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { url, setUrl, setRepo, reset } = useDemoRepoStore();
  const [urlInput, setUrlInput] = useState(url);
  const [parseError, setParseError] = useState<string | null>(null);

  const owner = useDemoRepoStore((s) => s.owner);
  const repo = useDemoRepoStore((s) => s.repo);

  const { branches, defaultBranch, isLoading: branchesLoading } = useBranches(owner, repo);

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const handleLoad = () => {
    const parsed = parseRepoUrl(urlInput);
    if (!parsed) {
      setParseError("Enter a valid GitHub repository URL, e.g. https://github.com/owner/repo");
      return;
    }
    setParseError(null);
    setUrl(urlInput.trim());
    setRepo(parsed.owner, parsed.repo);
  };

  const handleReset = () => {
    reset();
    setUrlInput("");
    setParseError(null);
    router.push("/app/demo");
  };

  const repository: GitHubRepository | null = owner && repo
    ? {
        id: DEMO_REPO_ID,
        name: repo,
        full_name: `${owner}/${repo}`,
        private: false,
        updated_at: "",
        owner: { login: owner },
      }
    : null;

  const selectedBranch = searchParams.get("branch") || defaultBranch || branches[0];

  return (
    <SectionLayout>
      <div className="mb-6 space-y-1.5">
        <h1 className="text-xl font-semibold">Demo</h1>
        <p className="text-sm text-muted-foreground">
          Paste any GitHub repository URL to preview its commits and generate a
          report. No setup required.
        </p>
      </div>

      <Card className="border-0 shadow-sm max-w-2xl mx-auto mb-6">
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-url" className="text-sm font-medium">
              Repository URL
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="repo-url"
                  className="pl-8"
                  placeholder="https://github.com/owner/repo"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setParseError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLoad();
                  }}
                />
              </div>
              {owner && repo ? (
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              ) : (
                <Button onClick={handleLoad}>Load</Button>
              )}
            </div>
            {parseError && (
              <p className="text-xs text-red-500">{parseError}</p>
            )}
          </div>

          {owner && repo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              {branchesLoading
                ? "Loading branches..."
                : `${branches.length} branch${branches.length === 1 ? "" : "es"} found`}
            </div>
          )}
        </CardContent>
      </Card>

      {repository && (
        <>
          <div className="mb-6 flex justify-center">
            <RepositoryInfoCard repository={repository} />
          </div>
          <SettingsForm
            repository={repository}
            branches={branches}
            selectedBranch={selectedBranch}
            startDate={searchParams.get("startDate") || today}
            endDate={searchParams.get("endDate") ?? undefined}
          />
        </>
      )}
    </SectionLayout>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={null}>
      <DemoPageContent />
    </Suspense>
  );
}
