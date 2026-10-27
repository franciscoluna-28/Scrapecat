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
  /** Dense layout for the add-repository dialog; Settings keeps the roomy one. */
  compact?: boolean;
};

export function GitProviderConnectForm({
  onConnected,
  className,
  provider: controlledProvider,
  onProviderChange,
  compact = false,
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
    const label =
      connection.source === "env"
        ? compact
          ? `${meta.label} · server connection`
          : `Connected via server ${meta.label} token`
        : compact
          ? `${meta.label} · @${connection.login ?? meta.label.toLowerCase()}`
          : `Connected as @${connection.login ?? meta.label.toLowerCase()}`;

    return (
      <div className={`${compact ? "space-y-2" : "space-y-3"} ${className ?? ""}`}>
        {AVAILABLE_PROVIDERS.length > 1 && (
          <ProviderTabs provider={provider} onSelect={selectProvider} />
        )}
        <div
          className={`flex items-center justify-between gap-2 ${compact ? "text-xs" : "text-sm"}`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <CheckCircle2
              className={`shrink-0 text-primary ${compact ? "size-3.5" : "size-4"}`}
            />
            <span className="truncate">{label}</span>
          </div>
          {connection.source !== "env" && (
            <Button
              variant="ghost"
              size={compact ? "xs" : "sm"}
              className="shrink-0 text-muted-foreground"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              <LogOut className="size-3" />
              Disconnect
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Compact: token entry in a single row, help text reduced to one small link.
  if (compact) {
    return (
      <div className={`space-y-2 ${className ?? ""}`}>
        {AVAILABLE_PROVIDERS.length > 1 && (
          <ProviderTabs provider={provider} onSelect={selectProvider} />
        )}

        <div className="flex items-center gap-2">
          <Input
            id="git-provider-token"
            type="password"
            autoComplete="off"
            aria-label={meta.tokenLabel}
            placeholder={meta.tokenPlaceholder}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Button
            size="sm"
            className="shrink-0"
            disabled={!token.trim() || connect.isPending}
            onClick={async () => {
              await connect.mutateAsync(token.trim());
              setToken("");
              onConnected?.();
            }}
          >
            {connect.isPending ? "Connecting…" : "Connect"}
          </Button>
        </div>

        <a
          href={meta.patUrl}
          target="_blank"
          rel="noreferrer"
          title={`Scopes: ${meta.scopes}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          Create a {meta.label} token
          <ExternalLink className="size-3" />
        </a>

        {connect.isError && (
          <p className="text-xs text-destructive">{(connect.error as Error).message}</p>
        )}
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

