"use client";

import { useState } from "react";
import { ExternalLink, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  useGitHubConnection,
  useConnectGitHubToken,
  useDisconnectGitHub,
  GITHUB_PAT_URL,
} from "@/src/_features/chat/services/git-api";

type Props = {
  onConnected?: () => void;
  className?: string;
};

export function GitHubConnectForm({ onConnected, className }: Props) {
  const { connection, isLoading } = useGitHubConnection();
  const connect = useConnectGitHubToken();
  const disconnect = useDisconnectGitHub();

  const [token, setToken] = useState("");

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Checking GitHub connection…</p>;
  }

  if (connection?.connected) {
    return (
      <div className={`flex items-center justify-between gap-3 ${className ?? ""}`}>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4 text-primary" />
          <span>
            {connection.source === "env"
              ? "Connected via server token"
              : `Connected as @${connection.login ?? "github"}`}
          </span>
        </div>
        {connection.source !== "env" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            <LogOut className="size-3.5" />
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="space-y-1">
        <p className="text-sm">Connect your GitHub account to browse and clone repositories.</p>
        <a
          href={GITHUB_PAT_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Generate a token on GitHub
          <ExternalLink className="size-3" />
        </a>
        <p className="text-[11px] text-muted-foreground">
          Use a fine-grained or classic token with <code>repo</code> and{" "}
          <code>read:user</code> scopes.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="github-token">Personal access token</Label>
        <Input
          id="github-token"
          type="password"
          autoComplete="off"
          placeholder="ghp_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>

      {connect.isError && (
        <p className="text-xs text-destructive">{(connect.error as Error).message}</p>
      )}

      <Button
        className="w-full"
        disabled={!token.trim() || connect.isPending}
        onClick={async () => {
          await connect.mutateAsync(token.trim());
          setToken("");
          onConnected?.();
        }}
      >
        {connect.isPending ? "Connecting…" : "Connect GitHub"}
      </Button>
    </div>
  );
}
