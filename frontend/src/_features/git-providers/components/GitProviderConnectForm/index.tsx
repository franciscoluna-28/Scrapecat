"use client";

import { useState } from "react";
import { ExternalLink, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { ProviderTabs } from "@/src/_features/git-providers/components/ProviderTabs";
import {
  useGitConnection,
  useConnectGitProvider,
  useDisconnectGitProvider,
} from "@/src/_features/git-providers/services/git-providers-api";
import {
  AVAILABLE_PROVIDERS,
  GIT_PROVIDER_META,
  type GitProviderId,
} from "@/src/shared/constants";

type Props = {
  onConnected?: () => void;
  className?: string;
  /** Controlled provider (optional) — used by the add-repository dialog. */
  provider?: GitProviderId;
  onProviderChange?: (provider: GitProviderId) => void;
};

export function GitProviderConnectForm({
  onConnected,
  className,
  provider: controlledProvider,
  onProviderChange,
}: Props) {
  const [internalProvider, setInternalProvider] =
    useState<GitProviderId>("github");
  const provider = controlledProvider ?? internalProvider;
  const meta = GIT_PROVIDER_META[provider];

  const { connection, isLoading } = useGitConnection(provider);
  const connect = useConnectGitProvider(provider);
  const disconnect = useDisconnectGitProvider(provider);

  const [token, setToken] = useState("");

  const selectProvider = (next: GitProviderId) => {
    if (next === provider) return;
    setToken("");
    connect.reset();
    disconnect.reset();
    if (controlledProvider === undefined) setInternalProvider(next);
    onProviderChange?.(next);
  };

  if (isLoading) {
    return (
      <p className="text-xs text-muted-foreground">
        Checking {meta.label} connection…
      </p>
    );
  }

  if (connection?.connected) {
    return (
      <div className={`space-y-3 ${className ?? ""}`}>
        {AVAILABLE_PROVIDERS.length > 1 && (
          <ProviderTabs
            provider={provider}
            onSelect={selectProvider}
          />
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-primary" />
            <span>
              {connection.source === "env"
                ? `Connected via server ${meta.label} token`
                : `Connected as @${connection.login ?? meta.label.toLowerCase()}`}
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
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {AVAILABLE_PROVIDERS.length > 1 && (
        <ProviderTabs provider={provider} onSelect={selectProvider} />
      )}

      <div className="space-y-1">
        <p className="text-sm">{meta.description}</p>
        <a
          href={meta.patUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          Generate a token on {meta.label}
          <ExternalLink className="size-3" />
        </a>
        <p className="text-[11px] text-muted-foreground">
          Use a token with <code>{meta.scopes}</code> scopes.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="git-provider-token">{meta.tokenLabel}</Label>
        <Input
          id="git-provider-token"
          type="password"
          autoComplete="off"
          placeholder={meta.tokenPlaceholder}
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
        {connect.isPending ? "Connecting…" : `Connect ${meta.label}`}
      </Button>
    </div>
  );
}

