"use client";

import { Card, CardContent } from "@/src/components/ui/card";
import { SectionLayout } from "@/src/components/global/SectionLayout";
import { DemoModeNotice } from "@/src/components/global/DemoModeNotice";
import { CredentialsManager } from "@/src/_features/credentials/components/CredentialsManager";
import { IS_DEMO } from "@/src/shared/constants";

export default function ApiKeysPage() {
  if (IS_DEMO) {
    return (
      <SectionLayout>
        <DemoModeNotice
          title="API Keys"
          description="API keys are managed by the server in demo mode. No keys or tokens are stored or exposed to visitors."
        />
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
