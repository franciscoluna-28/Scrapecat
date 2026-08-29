"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Link2 } from "lucide-react";
import { parseRepoUrl } from "@/src/shared/utils/repo-url";
import type { GitHubRepository } from "@/src/shared/types";

type Props = {
  repositories: GitHubRepository[];
};

export function ConnectRepositoryBar({ repositories }: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    const parsed = parseRepoUrl(value);
    if (!parsed) {
      setError("Enter a valid GitHub URL or owner/repo, e.g. https://github.com/owner/repo");
      return;
    }
    setError(null);
    setValue("");

    const match = repositories.find(
      (r) => `${r.owner.login}/${r.name}` === `${parsed.owner}/${parsed.repo}`,
    );
    if (match) {
      router.push(`/app/repos/${match.id}`);
    } else {
      router.push(`/app/repos/paste?owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Paste a GitHub URL or owner/repo"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConnect();
            }}
          />
        </div>
        <Button onClick={handleConnect}>Connect</Button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}
