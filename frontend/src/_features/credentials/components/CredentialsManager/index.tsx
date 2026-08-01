"use client";

import { Card, CardContent } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { XCircle } from "lucide-react";
import { useCredentials } from "@/src/_features/credentials/services";
import { PROVIDERS } from "@/src/shared/constants";
import { CredentialField } from "../CredentialField";

export function CredentialsManager() {
  const { credentials, isLoading, error } = useCredentials();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">API Keys</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Store one API key per AI provider. Keys are encrypted at rest.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600">Failed to load credentials</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {PROVIDERS.map((provider) => (
            <CredentialField
              key={provider.id}
              provider={provider}
              credential={credentials.find((c) => c.provider === provider.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
