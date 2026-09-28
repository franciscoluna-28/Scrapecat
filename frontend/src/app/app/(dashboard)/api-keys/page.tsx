"use client";

import { Card, CardContent } from "@/src/components/ui/card";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { CredentialsManager } from "@/src/_features/credentials/components/CredentialsManager";
import { IS_DEMO } from "@/src/shared/constants";

export default function ApiKeysPage() {
  if (IS_DEMO) {
    return (
      <SectionLayout>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold">API Keys</h3>
            <p className="text-xs text-muted-foreground mt-1">
              API keys are managed by the server in demo mode. No keys or tokens
              are stored or exposed to visitors.
            </p>
          </CardContent>
        </Card>
      </SectionLayout>
    );
  }

  return (
    <SectionLayout>
      <Card>
        <CardContent className="p-6">
          <CredentialsManager />
        </CardContent>
      </Card>
    </SectionLayout>
  );
}
